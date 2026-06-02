import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type DistributedLimiter = Pick<Ratelimit, "limit">;

const limiterCache = new Map<string, DistributedLimiter>();

function getDistributedLimiter(limit: number, windowMs: number): DistributedLimiter | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }

  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const cacheKey = `${limit}:${windowSeconds}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const redis = new Redis({ url, token });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix: "pathway:rl",
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

export async function consumeDistributedRateLimitBucket(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean } | null> {
  const limiter = getDistributedLimiter(limit, windowMs);
  if (!limiter) {
    return null;
  }

  try {
    const result = await limiter.limit(key);
    return { ok: result.success };
  } catch {
    return null;
  }
}
