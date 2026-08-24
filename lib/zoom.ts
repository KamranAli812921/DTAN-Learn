import crypto from "crypto";

const ZOOM_OAUTH_URL = "https://zoom.us/oauth/token";
const ZOOM_API_BASE = "https://api.zoom.us/v2";

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

/**
 * Fetch (and cache in-memory for the life of the serverless instance) a
 * Server-to-Server OAuth access token for the institutional Zoom account.
 */
export async function getZoomAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom credentials are not configured.");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(
    `${ZOOM_OAUTH_URL}?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${basicAuth}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to obtain Zoom access token: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export class ZoomApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function zoomFetch(path: string, init?: RequestInit) {
  const token = await getZoomAccessToken();
  const res = await fetch(`${ZOOM_API_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new ZoomApiError(res.status, `Zoom API error (${path}): ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Create a scheduled meeting for a batch's live class. */
export async function createZoomMeeting(opts: {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  hostEmail?: string;
}): Promise<{ id: string; join_url: string; start_url: string }> {
  const userId = opts.hostEmail || "me";
  const data = await zoomFetch(`/users/${userId}/meetings`, {
    method: "POST",
    body: JSON.stringify({
      topic: opts.topic,
      type: 2, // scheduled meeting
      start_time: opts.startTime.toISOString(),
      duration: opts.durationMinutes,
      settings: {
        join_before_host: true,
        waiting_room: false,
        approval_type: 2,
      },
    }),
  });
  return { id: String(data.id), join_url: data.join_url, start_url: data.start_url };
}

export interface ZoomParticipant {
  id: string; // participant UUID for this join segment
  user_id?: string;
  name: string;
  user_email?: string;
  join_time: string;
  leave_time: string;
  duration: number; // seconds
}

/**
 * Polling fallback: fetch the full participant report for a finished
 * meeting. Zoom logs every disconnect/rejoin as a separate entry — the
 * caller is responsible for merging entries by participant email/user id
 * into that student's Attendance.sessions[] array (see
 * lib/attendance-sync.ts) rather than overwriting prior segments.
 */
export async function getMeetingParticipants(meetingId: string): Promise<ZoomParticipant[]> {
  const participants: ZoomParticipant[] = [];
  let nextPageToken = "";
  try {
    do {
      const query = new URLSearchParams({ page_size: "300" });
      if (nextPageToken) query.set("next_page_token", nextPageToken);
      const data = await zoomFetch(`/report/meetings/${meetingId}/participants?${query.toString()}`);
      participants.push(...(data.participants || []));
      nextPageToken = data.next_page_token || "";
    } while (nextPageToken);
  } catch (err) {
    // Zoom has no participants report for a meeting that was scheduled but
    // never actually started (nobody, including the host, joined) — it
    // returns 404 "Meeting does not exist" for the report endpoint in that
    // case. Treat that the same as zero participants instead of failing the
    // whole sync, so markAbsentees still runs and marks everyone absent.
    if (err instanceof ZoomApiError && err.status === 404) {
      return [];
    }
    throw err;
  }
  return participants;
}

/**
 * Verify Zoom's webhook signature (x-zm-signature header) using the
 * Webhook Secret Token, per Zoom's documented HMAC-SHA256 scheme:
 * message = `v0:${timestamp}:${rawBody}`, signature = `v0=${hmac}`.
 */
export function verifyZoomSignature(rawBody: string, timestamp: string, signatureHeader: string): boolean {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret) return false;

  const message = `v0:${timestamp}:${rawBody}`;
  const hash = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const expected = `v0=${hash}`;

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
