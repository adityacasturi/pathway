/** Join Set-Cookie header values into a single Cookie request header. */
export function mergeCookieHeaders(setCookie: string[]): string | null {
  const parts = setCookie
    .map((value) => value.split(";")[0]?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("; ") : null;
}
