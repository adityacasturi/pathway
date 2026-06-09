const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
];

function looksLikePrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const mappedIpv4 = ipv4FromMappedIpv6(host);
  if (mappedIpv4) {
    return PRIVATE_IPV4_RANGES.some((range) => range.test(mappedIpv4));
  }

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  ) {
    return true;
  }
  return PRIVATE_IPV4_RANGES.some((range) => range.test(host));
}

function ipv4FromMappedIpv6(host: string): string | null {
  const match = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return null;

  const high = Number.parseInt(match[1]!, 16);
  const low = Number.parseInt(match[2]!, 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

/**
 * Cleans up a user-typed URL: trims whitespace, treats blank as `null`, and
 * auto-prepends `https://` when no scheme is present so paste-and-go works.
 */
export function normalizeUrl(input: string | null | undefined): string | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/**
 * Validates URLs before we store them as application links or send an
 * browser to them. Blocks non-web schemes and local/private hosts
 * to reduce XSS-by-link and SSRF-style browser navigation risk.
 */
export function validateExternalHttpUrl(
  input: string | null | undefined,
): { url: string | null; error?: string } {
  const normalized = normalizeUrl(input);
  if (!normalized) return { url: null };

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { url: null, error: "Enter a valid http(s) URL." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { url: null, error: "Only http(s) URLs are allowed." };
  }
  if (parsed.username || parsed.password) {
    return { url: null, error: "URLs with embedded credentials are not allowed." };
  }
  if (looksLikePrivateHost(parsed.hostname)) {
    return { url: null, error: "Local or private-network URLs are not allowed." };
  }

  return { url: parsed.toString() };
}

export function safeExternalHref(input: string | null | undefined): string | null {
  return validateExternalHttpUrl(input).url;
}

/**
 * Returns a short host-only display label for a URL, falling back to the raw
 * string when parsing fails. Strips `www.` for brevity.
 */
export function displayUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
