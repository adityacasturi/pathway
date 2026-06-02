import { NextResponse } from "next/server";
import { consumeUnsubscribeNonce, disableAlertEmails } from "@/lib/alerts/load-alert-data";
import { unsubscribePageHtml } from "@/lib/alerts/unsubscribe-html";
import { verifyUnsubscribeToken } from "@/lib/alerts/unsubscribe-token";
import { getUnsubscribeSecret } from "@/lib/alerts/site-url";
import { limitRequestByIpAsync } from "@/lib/rate-limit-buckets";
import { createAdminClient } from "@/lib/supabase/admin";

const UNSUBSCRIBE_RATE_LIMIT = 30;
const UNSUBSCRIBE_RATE_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const rateLimit = await limitRequestByIpAsync(
    request,
    "alerts:unsubscribe",
    UNSUBSCRIBE_RATE_LIMIT,
    UNSUBSCRIBE_RATE_WINDOW_MS,
  );
  if (!rateLimit.ok) {
    return respondWithHtml("Slow down", rateLimit.error ?? "Too many requests.", false, 429);
  }

  const secret = getUnsubscribeSecret();
  if (!secret) {
    return respondWithHtml(
      "Unavailable",
      "Email alerts are unavailable right now.",
      false,
      503,
    );
  }

  const token = readToken(request);
  if (!token) {
    return respondWithHtml("Invalid link", "This unsubscribe link is invalid.", false, 400);
  }

  const verified = verifyUnsubscribeToken(token, secret);
  if (!verified) {
    return respondWithHtml(
      "Invalid link",
      "This unsubscribe link is invalid or expired.",
      false,
      400,
    );
  }

  return respondWithHtml(
    "Confirm unsubscribe",
    "You're about to turn off all Pathway email alerts for your account.",
    false,
    200,
    { token, showConfirm: true },
  );
}

export async function POST(request: Request) {
  const rateLimit = await limitRequestByIpAsync(
    request,
    "alerts:unsubscribe",
    UNSUBSCRIBE_RATE_LIMIT,
    UNSUBSCRIBE_RATE_WINDOW_MS,
  );
  if (!rateLimit.ok) {
    return respondWithHtml("Slow down", rateLimit.error ?? "Too many requests.", false, 429);
  }

  const secret = getUnsubscribeSecret();
  if (!secret) {
    return respondWithHtml(
      "Unavailable",
      "Email alerts are unavailable right now.",
      false,
      503,
    );
  }

  const token = await readTokenFromBody(request);
  if (!token) {
    return respondWithHtml("Invalid link", "This unsubscribe link is invalid.", false, 400);
  }

  const verified = verifyUnsubscribeToken(token, secret);
  if (!verified) {
    return respondWithHtml(
      "Invalid link",
      "This unsubscribe link is invalid or expired.",
      false,
      400,
    );
  }

  try {
    const supabase = createAdminClient();
    // Apply the (idempotent) opt-out first, then spend the one-time nonce. This
    // ordering guarantees a transient failure never burns the nonce and leaves
    // the user holding a dead link with alerts still enabled.
    await disableAlertEmails(supabase, verified.userId);
    const firstUse = await consumeUnsubscribeNonce(supabase, verified.userId, verified.nonce);
    if (!firstUse) {
      return respondWithHtml(
        "Already unsubscribed",
        "This unsubscribe link was already used. You're unsubscribed from Pathway email alerts.",
        true,
        200,
      );
    }
  } catch {
    return respondWithHtml(
      "Something went wrong",
      "We couldn't update your alert settings. Try again from Pathway.",
      false,
      500,
    );
  }

  return respondWithHtml(
    "Unsubscribed",
    "You're unsubscribed from Pathway email alerts.",
    true,
    200,
  );
}

function readToken(request: Request): string | null {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  return token || null;
}

async function readTokenFromBody(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const token = params.get("token")?.trim();
    return token || null;
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const token = formData.get("token");
    if (typeof token === "string" && token.trim()) {
      return token.trim();
    }
  }

  return readToken(request);
}

function respondWithHtml(
  title: string,
  message: string,
  success: boolean,
  status: number,
  options?: { token?: string; showConfirm?: boolean },
) {
  const html = unsubscribePageHtml({
    title,
    message,
    success,
    token: options?.token,
    showConfirm: options?.showConfirm,
  });

  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
