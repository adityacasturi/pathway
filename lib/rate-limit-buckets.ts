type Bucket = { count: number; resetAt: number };

const RATE_LIMIT_BUCKETS_KEY = Symbol.for("internship-tracker.rate-limit-buckets");
const globalBuckets = globalThis as typeof globalThis & {
  [RATE_LIMIT_BUCKETS_KEY]?: Map<string, Bucket>;
};

const buckets = globalBuckets[RATE_LIMIT_BUCKETS_KEY] ?? new Map<string, Bucket>();
globalBuckets[RATE_LIMIT_BUCKETS_KEY] = buckets;
const MAX_BUCKETS = 5_000;

export type RateLimitResult = {
  ok: boolean;
  error?: string;
};

export function clientKeyFromHeaders(source: Headers): string {
  const forwardedFor = source.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    source.get("cf-connecting-ip") ??
    source.get("x-real-ip") ??
    forwardedFor ??
    "unknown"
  );
}

import { consumeDistributedRateLimitBucket } from "@/lib/rate-limit-distributed";

export function consumeInMemoryRateLimitBucket(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    if (buckets.size > MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value as string | undefined;
      if (oldestKey) buckets.delete(oldestKey);
    }
  }

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (current.count >= limit) {
    return { ok: false, error: "Too many attempts. Please wait a moment and try again." };
  }

  current.count += 1;
  return { ok: true };
}

export async function consumeRateLimitBucket(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const distributed = await consumeDistributedRateLimitBucket(key, limit, windowMs);
  if (distributed) {
    return distributed.ok
      ? { ok: true }
      : { ok: false, error: "Too many attempts. Please wait a moment and try again." };
  }

  return consumeInMemoryRateLimitBucket(key, limit, windowMs);
}

export function limitRequestByIp(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  return consumeInMemoryRateLimitBucket(
    `${bucket}:${clientKeyFromHeaders(request.headers)}`,
    limit,
    windowMs,
  );
}

export async function limitRequestByIpAsync(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return consumeRateLimitBucket(
    `${bucket}:${clientKeyFromHeaders(request.headers)}`,
    limit,
    windowMs,
  );
}
