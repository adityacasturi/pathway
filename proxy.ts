import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth gate that runs before every (non-asset) route.
 *
 * Behavior:
 * - Fast path: if the request has no Supabase auth cookie, the user is
 *   definitively anonymous, so we skip the cross-region `auth.getUser()`
 *   round-trip entirely. This is what makes public navigation snappy.
 * - Otherwise refreshes the Supabase session via cookies on each request.
 * - Redirects unauthenticated users to sign in with a safe return path (except public routes).
 * - `/api/logo` requires authentication; `/company-logos/` is public (landing).
 * - Redirects already-signed-in users away from public auth/landing routes back to the app.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/auth/confirm" ||
    pathname === "/api/cron/scrape-postings" ||
    pathname === "/api/cron/send-instant-alerts" ||
    pathname === "/api/cron/send-alert-digests" ||
    pathname.startsWith("/alerts/unsubscribe") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/school-logos/") ||
    pathname.startsWith("/company-logos/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png";

  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!hasAuthCookie) {
    if (!isPublicRoute) return NextResponse.redirect(getLoginRedirectUrl(request));
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute) return NextResponse.redirect(getLoginRedirectUrl(request));

  if (user && (pathname === "/" || pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return supabaseResponse;
}

function getLoginRedirectUrl(request: NextRequest) {
  const redirectUrl = new URL("/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  redirectUrl.searchParams.set("next", nextPath);
  return redirectUrl;
}

export const config = {
  // Skip Next.js internals and static assets so we don't run auth checks for
  // every request for /favicon.ico, hashed JS chunks, etc.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
