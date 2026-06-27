/** Join Set-Cookie header values into a single Cookie request header. */
export function mergeCookieHeaders(setCookie: string[]): string | null {
  const parts = setCookie
    .map((value) => value.split(";")[0]?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("; ") : null;
}

/** Merge Set-Cookie values into an existing Cookie header, replacing same-name cookies. */
export function accumulateCookieHeaders(
  existing: string | null | undefined,
  setCookie: string[],
): string | null {
  const byName = new Map<string, string>();

  for (const part of existing?.split(";") ?? []) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const name = trimmed.split("=")[0]?.trim();
    if (name) byName.set(name, trimmed);
  }

  for (const cookie of setCookie) {
    const nameValue = cookie.split(";")[0]?.trim();
    if (!nameValue) continue;
    const name = nameValue.split("=")[0]?.trim();
    if (!name) continue;
    byName.set(name, nameValue);
  }

  if (byName.size === 0) return null;
  return [...byName.values()].join("; ");
}
