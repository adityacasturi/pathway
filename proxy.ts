import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth gate that runs before every (non-asset) route.
 *
 * Behavior:
 * - Refreshes the Supabase session via cookies on each request.
 * - Redirects unauthenticated users to the public landing page (except public routes).
 * - Redirects already-signed-in users away from public auth/landing routes back to the app.
 */
export async function proxy(request: NextRequest) {
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

  const { pathname } = request.nextUrl;
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/school-logos/") ||
    pathname.startsWith("/product-screenshots/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png";

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && (pathname === "/" || pathname === "/login")) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return supabaseResponse;
}

export const config = {
  // Skip Next.js internals and static assets so we don't run auth checks for
  // every request for /favicon.ico, hashed JS chunks, etc.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
