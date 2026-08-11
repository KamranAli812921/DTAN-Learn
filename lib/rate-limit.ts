import { RateLimitEvent } from "@/models";

/**
 * Record a hit for `key` and check whether it exceeds `max` within
 * `windowMs`. Backed by a Mongo collection (with TTL cleanup) since
 * serverless functions don't share in-memory state across invocations.
 */
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);
  const count = await RateLimitEvent.countDocuments({ key, createdAt: { $gte: windowStart } });
  if (count >= max) return false;
  await RateLimitEvent.create({ key });
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
