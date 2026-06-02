import { timingSafeEqual } from "node:crypto";

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const auth = request.headers.get("authorization");
  if (!auth) {
    return false;
  }

  const expected = `Bearer ${secret}`;
  const authBuf = Buffer.from(auth);
  const expectedBuf = Buffer.from(expected);

  if (authBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(authBuf, expectedBuf);
}
