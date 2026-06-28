import { NextResponse } from "next/server";
import { invalidateCatalogCacheTags } from "@/lib/cache/invalidate-catalog";

/**
 * On-demand catalog cache bust after hourly scrapes (GitHub Actions).
 * Requires `CATALOG_REVALIDATE_SECRET` and `Authorization: Bearer <secret>`.
 */
export async function POST(request: Request) {
  const secret = process.env.CATALOG_REVALIDATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Revalidation not configured." }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  invalidateCatalogCacheTags();
  return NextResponse.json({ ok: true });
}
