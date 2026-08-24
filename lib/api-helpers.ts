import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import type { UserRole } from "@/models/User";
import { ZoomApiError } from "@/lib/zoom";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Get the current session, or throw a 401 ApiError if there isn't one. */
export async function requireSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new ApiError(401, "Not authenticated.");
  }
  if (session.user.status !== "active") {
    throw new ApiError(403, "Account is deactivated.");
  }
  return session;
}

/** Get the current session and assert it has one of the allowed roles. */
export async function requireRole(...roles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  return session;
}

/** Wrap a route handler; converts thrown ApiError/ZodError into clean JSON responses. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed.", issues: err.flatten() },
      { status: 400 }
    );
  }
  if (err instanceof Error && (err as { code?: number }).code === 11000) {
    return NextResponse.json({ error: "A record with these details already exists." }, { status: 409 });
  }
  if (err instanceof ZoomApiError) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json({ error: `Zoom error: ${err.message}` }, { status: 502 });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
