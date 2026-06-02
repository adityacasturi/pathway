import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Default: 30 days. */
export const ALERT_UNSUBSCRIBE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface UnsubscribePayload {
  userId: string;
  exp: number;
  nonce: string;
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function encodePayload(payload: UnsubscribePayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): UnsubscribePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as UnsubscribePayload;
    if (
      typeof parsed.userId !== "string" ||
      !UUID_RE.test(parsed.userId) ||
      typeof parsed.exp !== "number" ||
      typeof parsed.nonce !== "string" ||
      parsed.nonce.length < 8
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createUnsubscribeToken(
  userId: string,
  secret: string,
  options?: { ttlMs?: number; nonce?: string },
): string {
  const ttlMs = options?.ttlMs ?? ALERT_UNSUBSCRIBE_TOKEN_TTL_MS;
  const payload: UnsubscribePayload = {
    userId,
    exp: Date.now() + ttlMs,
    nonce: options?.nonce ?? randomBytes(16).toString("base64url"),
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signPayload(encoded, secret)}`;
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
  now = Date.now(),
): { userId: string; nonce: string } | null {
  const [encodedPayload, sig] = token.split(".");
  if (!encodedPayload || !sig) return null;

  const expectedSig = signPayload(encodedPayload, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload || payload.exp < now) {
    return null;
  }

  return { userId: payload.userId, nonce: payload.nonce };
}
