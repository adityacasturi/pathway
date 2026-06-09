export function getSafeInternalPath(
  value: string | null | undefined,
  fallback: string,
  options: { blockedPrefixes?: string[] } = {},
): string {
  const path = value?.trim();
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }

  const pathname = path.split(/[?#]/, 1)[0] ?? path;
  if (options.blockedPrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return fallback;
  }

  return path;
}
