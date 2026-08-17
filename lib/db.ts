import dns from "dns";
import mongoose from "mongoose";

// Some Windows dev setups leave Node's own resolver pointed at 127.0.0.1
// with nothing listening there, which breaks the SRV lookup mongodb+srv://
// needs even though the OS resolver works fine for everything else. Force a
// real DNS server in dev only — production platforms (e.g. Vercel) already
// have a working resolver and shouldn't have this overridden.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Reuse the connection across hot-reloads in dev and across serverless
// invocations on Vercel to avoid exhausting MongoDB's connection limit.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to your .env.local file.");
  }

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      dbName: "DTAN-Learn",
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}

export default connectDB;
