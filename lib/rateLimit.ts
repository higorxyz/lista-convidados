import { Redis } from "@upstash/redis";

const kv = Redis.fromEnv();

/**
 * Fixed-window rate limiter. Returns true if the request should be allowed.
 * Used to slow down attempts to enumerate the guest list via last-4-digit guessing.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;
  const count = await kv.incr(redisKey);
  if (count === 1) {
    await kv.expire(redisKey, windowSeconds);
  }
  return count <= limit;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
