import { config } from "./config";

// In-memory, per-IP fixed-window rate limiter.
//
// CAVEAT FOR VERCEL / SERVERLESS: this Map lives in the memory of a single
// serverless function instance. Vercel can spin up multiple concurrent
// instances (and recycle/cold-start them), so this limiter does NOT provide a
// global guarantee — a client could get up to N requests per instance, and
// counters reset whenever an instance is recycled. It is a cheap safety net,
// not a hard limit, and will not survive serverless scale-out.
//
// TO MAKE THIS ACCURATE IN PRODUCTION ON VERCEL, swap this module for
// Upstash Redis (free tier works well), e.g.:
//
//   import { Ratelimit } from "@upstash/ratelimit";
//   import { Redis } from "@upstash/redis";
//   const redis = Redis.fromEnv();
//   const ratelimit = new Ratelimit({
//     redis,
//     limiter: Ratelimit.slidingWindow(config.rateLimitPerMinute, "1 m"),
//   });
//   export async function checkRateLimit(ip: string) {
//     const { success } = await ratelimit.limit(ip);
//     return success;
//   }
//
// and set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN as env vars.

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (bucket.count >= config.rateLimitPerMinute) {
    return false;
  }

  bucket.count += 1;
  return true;
}

// Opportunistic cleanup so the Map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) buckets.delete(ip);
  }
}, WINDOW_MS).unref?.();
