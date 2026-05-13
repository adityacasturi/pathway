"use server";

import { createClient } from "@/lib/supabase/server";
import { limitServerActionByIp } from "@/lib/rate-limit";
import { getEmailValidationError, normalizeEmail } from "@/lib/auth/validation";

export async function joinWaitlist(
  formData: FormData,
): Promise<{ ok: true; alreadyJoined: boolean } | { error: string }> {
  const rateLimit = await limitServerActionByIp("waitlist:join", 4, 60_000);
  if (!rateLimit.ok) {
    return { error: rateLimit.error ?? "Too many requests. Please try again shortly." };
  }

  const email = formData.get("email");
  if (typeof email !== "string") return { error: "Email is required." };
  const emailError = getEmailValidationError(email);
  if (emailError) return { error: emailError };
  const cleanEmail = normalizeEmail(email);

  const supabase = await createClient();
  const { error: insertError } = await supabase
    .from("waitlist")
    .insert({ email: cleanEmail, source: "landing" });

  const isDuplicate = insertError?.code === "23505";
  if (insertError && !isDuplicate) {
    console.error("[waitlist] insert failed", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });
    return { error: "Unable to join the waitlist. Please try again." };
  }

  const alreadyJoined = isDuplicate;
  console.log("[waitlist] joined", { email: cleanEmail, alreadyJoined });

  // Best-effort push to Resend Audiences. Supabase row is the source of truth.
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    console.warn("[waitlist] resend env vars missing", {
      hasApiKey: Boolean(apiKey),
      hasAudienceId: Boolean(audienceId),
    });
  } else if (!alreadyJoined) {
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
          body,
        });
      } else {
        console.log("[waitlist] resend contact created", { email: cleanEmail });
      }
    } catch (err) {
      console.error("[waitlist] resend contact create threw", err);
    }
  }

  return { ok: true, alreadyJoined };
}
