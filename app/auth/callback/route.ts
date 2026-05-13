import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles redirects from Supabase Auth emails (invite, magic link, recovery).
 *
 * Reads the PKCE `code` query param, exchanges it for a session, and forwards
 * the user to a safe in-app destination. Defaults to `/set-password` so invited
 * users immediately set a password before landing on the app.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/set-password";
  const errorDescription =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(`/login?invite_error=${encodeURIComponent(errorDescription)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?invite_error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
