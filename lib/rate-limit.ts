import { headers } from "next/headers";
import {
  clientKeyFromHeaders,
  consumeRateLimitBucket,
  type RateLimitResult,
} from "@/lib/rate-limit-buckets";

export type { RateLimitResult } from "@/lib/rate-limit-buckets";
export { limitRequestByIp } from "@/lib/rate-limit-buckets";

export async function limitServerActionByIp(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const requestHeaders = await headers();
  return await consumeRateLimitBucket(
    `${bucket}:${clientKeyFromHeaders(requestHeaders)}`,
    limit,
    windowMs,
  );
}
