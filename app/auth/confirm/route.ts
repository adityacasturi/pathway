import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles invite, magic-link, and recovery confirmations.
 *
 * The Supabase email template links here with `?token_hash=...&type=...`,
 * we verify the OTP server-side, write the session cookies, and forward the
 * user to a safe in-app destination (defaults to `/set-password` for invites).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/set-password";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/login?invite_error=missing_token", url.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?invite_error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
