"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { clientKeyFromHeaders, limitServerActionByIp } from "@/lib/rate-limit";
import { getSignupEmailValidationError, normalizeEmail } from "@/lib/auth/validation";

type WaitlistRpcResult =
  | { ok: true; alreadyJoined: boolean }
  | { ok: false; error: string };

function parseWaitlistRpcResult(data: unknown): WaitlistRpcResult {
  if (
    data &&
    typeof data === "object" &&
    "ok" in data &&
    (data as { ok: unknown }).ok === true
  ) {
    return {
      ok: true,
      alreadyJoined: Boolean((data as { alreadyJoined?: unknown }).alreadyJoined),
    };
  }

  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string"
  ) {
    return { ok: false, error: (data as { error: string }).error };
  }

  return { ok: false, error: "Unable to join the waitlist. Please try again." };
}

export async function joinWaitlist(
  formData: FormData,
): Promise<{ ok: true; alreadyJoined: boolean } | { error: string }> {
  const rateLimit = await limitServerActionByIp("waitlist:join", 4, 60_000);
  if (!rateLimit.ok) {
    return { error: rateLimit.error ?? "Too many requests. Please try again shortly." };
  }

  const email = formData.get("email");
  if (typeof email !== "string") return { error: "Email is required." };
  const emailError = getSignupEmailValidationError(email);
  if (emailError) return { error: emailError };
  const cleanEmail = normalizeEmail(email);
  const requestHeaders = await headers();
  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("join_waitlist", {
    p_email: cleanEmail,
    p_ip_key: clientKeyFromHeaders(requestHeaders),
    p_source: "landing",
  });

  if (rpcError) {
    console.error("[waitlist] rpc failed", {
      code: rpcError.code,
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
    });
    return { error: "Unable to join the waitlist. Please try again." };
  }

  const result = parseWaitlistRpcResult(data);
  if (!result.ok) return { error: result.error };

  console.log("[waitlist] joined", { duplicate: result.alreadyJoined });

  // Best-effort push to Resend Audiences. Supabase row is the source of truth.
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    console.warn("[waitlist] resend env vars missing", {
      hasApiKey: Boolean(apiKey),
      hasAudienceId: Boolean(audienceId),
    });
  } else if (!result.alreadyJoined) {
    try {
      const response = await fetch(
        `https://api.resend.com/audiences/${audienceId}/contacts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: cleanEmail, unsubscribed: false }),
        },
      );
      if (!response.ok) {
        const body = await response.text();
        console.error("[waitlist] resend contact create failed", {
          status: response.status,
          bodyLength: body.length,
        });
      } else {
        console.log("[waitlist] resend contact created");
      }
    } catch (err) {
      console.error("[waitlist] resend contact create threw", {
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { ok: true, alreadyJoined: result.alreadyJoined };
}
