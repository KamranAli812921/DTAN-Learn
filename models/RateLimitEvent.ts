import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * Generic append-only event log used for simple rate limiting on serverless
 * (in-memory counters don't survive across invocations). Each request that
 * should be rate-limited inserts one document keyed by e.g.
 * "forgot-password:email:foo@bar.com" or "forgot-password:ip:1.2.3.4";
 * the caller counts documents within the trailing window.
 */
export interface IRateLimitEvent extends Document {
  key: string;
  createdAt: Date;
}

const RateLimitEventSchema = new Schema<IRateLimitEvent>({
  key: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

RateLimitEventSchema.index({ key: 1, createdAt: -1 });
// Auto-purge after 1 hour — comfortably longer than any window we check.
RateLimitEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });

const RateLimitEvent: Model<IRateLimitEvent> =
  models.RateLimitEvent || model<IRateLimitEvent>("RateLimitEvent", RateLimitEventSchema);
export default RateLimitEvent;
