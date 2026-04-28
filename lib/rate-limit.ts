import { headers } from "next/headers";

const buckets = new Map<string, { count: number; resetAt: number }>();

type RateLimitResult = {
  ok: boolean;
  error?: string;
};

function consumeBucket(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

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
