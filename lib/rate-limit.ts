import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

const RATE_LIMIT_BUCKETS_KEY = Symbol.for("internship-tracker.rate-limit-buckets");
const globalBuckets = globalThis as typeof globalThis & {
  [RATE_LIMIT_BUCKETS_KEY]?: Map<string, Bucket>;
};

const buckets = globalBuckets[RATE_LIMIT_BUCKETS_KEY] ?? new Map<string, Bucket>();
globalBuckets[RATE_LIMIT_BUCKETS_KEY] = buckets;
const MAX_BUCKETS = 5_000;

type RateLimitResult = {
  ok: boolean;
  error?: string;
};

function consumeBucket(key: string, limit: number, windowMs: number): RateLimitResult {
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

function clientKeyFromHeaders(source: Headers): string {
  const forwardedFor = source.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    source.get("cf-connecting-ip") ??
    source.get("x-real-ip") ??
    forwardedFor ??
    "unknown"
  );
}

export async function limitServerActionByIp(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const requestHeaders = await headers();
  return consumeBucket(`${bucket}:${clientKeyFromHeaders(requestHeaders)}`, limit, windowMs);
}

export function limitRequestByIp(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  return consumeBucket(`${bucket}:${clientKeyFromHeaders(request.headers)}`, limit, windowMs);
}

export async function consumeAuthenticatedRateLimit(
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const allowed =
    typeof data === "object" &&
    data !== null &&
    "allowed" in data &&
    (data as { allowed: unknown }).allowed === true;

  return allowed
    ? { ok: true }
    : { ok: false, error: "Too many attempts. Please wait a moment and try again." };
}
