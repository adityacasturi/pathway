import { NextRequest } from "next/server";
import { logoDevReferer, logoProxyStatusFromUpstream } from "@/lib/logo/upstream";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

const LOGO_DEV_TOKEN = process.env.LOGO_DEV_TOKEN;
const CANONICAL_SIZE = 128;
const CACHE_SECONDS = 60 * 60 * 24 * 30;
const NEGATIVE_CACHE_SECONDS = 60 * 60 * 24;
const FETCH_TIMEOUT_MS = 8000;
const TRANSIENT_CACHE = "no-store";

export const dynamic = "force-dynamic";

function cleanCompany(raw: string | null): string | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value || value.length > 120) return null;
  return value;
}

function cleanDomain(raw: string | null): string | null {
  const value = (raw ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!value || value.length > 253 || !value.includes(".")) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
    return null;
  }
  return value;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Referer: logoDevReferer() },
      next: { revalidate: CACHE_SECONDS, tags: ["company-logos"] },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function logoDevUpstreamUrl(domain: string | null, company: string | null): string | null {
  if (!LOGO_DEV_TOKEN) return null;

  const token = encodeURIComponent(LOGO_DEV_TOKEN);
  const size = CANONICAL_SIZE;
  const format = "png";

  if (domain) {
    return (
      `https://img.logo.dev/${encodeURIComponent(domain)}` +
      `?token=${token}&size=${size}&format=${format}`
    );
  }

  if (company) {
    return (
      `https://img.logo.dev/name/${encodeURIComponent(company)}` +
      `?token=${token}&size=${size}&format=${format}`
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const domain = cleanDomain(request.nextUrl.searchParams.get("domain"));
  const company = cleanCompany(request.nextUrl.searchParams.get("company"));
  const upstreamUrl = logoDevUpstreamUrl(domain, company);

  if (!upstreamUrl) {
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": LOGO_DEV_TOKEN
          ? `private, max-age=${NEGATIVE_CACHE_SECONDS}`
          : "no-store",
      },
    });
  }

  try {
    const upstream = await fetchWithTimeout(upstreamUrl);
    const proxyStatus = logoProxyStatusFromUpstream(upstream.status);

    if (proxyStatus !== 200 || !upstream.body) {
      const cacheControl =
        proxyStatus === 404
          ? `private, max-age=${NEGATIVE_CACHE_SECONDS}`
          : TRANSIENT_CACHE;
      return new Response(null, {
        status: proxyStatus,
        headers: { "Cache-Control": cacheControl },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `private, max-age=${CACHE_SECONDS}, immutable`,
      },
    });
  } catch {
    // Timeouts and network errors are not "missing logos" — avoid caching a false 404.
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": TRANSIENT_CACHE },
    });
  }
}
