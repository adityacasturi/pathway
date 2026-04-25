import { NextRequest } from "next/server";

const LOGO_DEV_TOKEN = process.env.LOGO_DEV_TOKEN ?? process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
const CANONICAL_SIZE = 128;
const CACHE_SECONDS = 60 * 60 * 24 * 30;
const NEGATIVE_CACHE_SECONDS = 60 * 60 * 24;
const FETCH_TIMEOUT_MS = 2500;

function cleanCompany(raw: string | null): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || value.length > 120) return null;
  return value;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      next: { revalidate: CACHE_SECONDS, tags: ["company-logos"] },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const company = cleanCompany(request.nextUrl.searchParams.get("company"));
  if (!company || !LOGO_DEV_TOKEN) {
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": `public, max-age=${NEGATIVE_CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      },
    });
  }

  const upstreamUrl =
    `https://img.logo.dev/name/${encodeURIComponent(company)}` +
    `?token=${encodeURIComponent(LOGO_DEV_TOKEN)}` +
    `&size=${CANONICAL_SIZE}&format=png`;

  try {
    const upstream = await fetchWithTimeout(upstreamUrl);
    if (!upstream.ok || !upstream.body) {
      return new Response(null, {
        status: 404,
        headers: {
          "Cache-Control": `public, max-age=${NEGATIVE_CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
        },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, immutable`,
      },
    });
  } catch {
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": `public, max-age=${NEGATIVE_CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      },
    });
  }
}

