import { headers } from "next/headers";
import { consumeRateLimitBucket } from "@/lib/rate-limit-buckets";

const CHAT_USER_LIMIT = 30;
const CHAT_USER_WINDOW_MS = 60 * 60 * 1000;
const CHAT_IP_LIMIT = 60;
const CHAT_IP_WINDOW_MS = 60 * 60 * 1000;

export async function limitChatByUser(userId: string) {
  return consumeRateLimitBucket(`chat:user:${userId}`, CHAT_USER_LIMIT, CHAT_USER_WINDOW_MS);
}

export async function limitChatByIp() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey =
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-real-ip") ??
    forwardedFor ??
    "unknown";

  return consumeRateLimitBucket(`chat:ip:${clientKey}`, CHAT_IP_LIMIT, CHAT_IP_WINDOW_MS);
}
