import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProxyPublicBypassPath } from "@/lib/auth/proxy-public-paths";
import { isMaintenanceMode, MAINTENANCE_PATH } from "@/lib/config/maintenance-mode";

/**
 * Auth gate that runs before every (non-asset) route.
 *
 * Behavior:
 * - Fast path: if the request has no Supabase auth cookie, the user is
 *   definitively anonymous, so we skip the cross-region `auth.getUser()`
 *   round-trip entirely. This is what makes public navigation snappy.
 * - Public assets and machine endpoints bypass auth checks even when the
 *   browser sends Supabase cookies.
 * - Otherwise refreshes the Supabase session via cookies on each request.
 * - Redirects unauthenticated users to sign in with a safe return path (except public routes).
 * - `/api/logo` requires authentication; `/company-logos/` is public (landing).
 * - Redirects already-signed-in users away from public auth/landing routes back to the app.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isMaintenanceMode()) {
    if (pathname === MAINTENANCE_PATH) {
      const response = NextResponse.next({ request });
      response.headers.set("Retry-After", "3600");
      return response;
    }

    const response = NextResponse.rewrite(new URL(MAINTENANCE_PATH, request.url), {
      status: 503,
    });
    response.headers.set("Retry-After", "3600");
    return response;
  }

  const isAuthRedirectRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register";
  const isPublicRoute = isAuthRedirectRoute || isProxyPublicBypassPath(pathname);

  if (isProxyPublicBypassPath(pathname)) {
    return NextResponse.next({ request });
  }

  const hasAuthCookie = hasSupabaseAuthCookie(request);

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

  if (user && isAuthRedirectRoute) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return supabaseResponse;
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|icon.png|apple-icon.png|brand(?:/|$)|school-logos(?:/|$)|company-logos(?:/|$)|api/revalidate-catalog$).*)",
  ],
};
