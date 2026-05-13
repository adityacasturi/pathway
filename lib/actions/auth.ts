"use server";

import { createClient } from "@/lib/supabase/server";
import { limitServerActionByIp } from "@/lib/rate-limit";
import {
  MAX_PASSWORD_LENGTH,
  getEmailValidationError,
  getSignupEmailValidationError,
  getSignupPasswordError,
  normalizeEmail,
} from "@/lib/auth/validation";
import { redirect } from "next/navigation";
import { SIGNUPS_ENABLED } from "@/lib/auth/signup-enabled";

type AuthActionResult =
  | { status: "authenticated" }
  | { status: "confirmation_required" }
  | { status: "already_confirmed" }
  | { error: string };

type AuthErrorLike = {
  message: string;
  code?: string;
  status?: number;
};

function formatAuthError(error: AuthErrorLike) {
  const message = error.message.trim();
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (message.toLowerCase().includes("email rate limit")) {
    return "Confirmation emails are temporarily rate limited. Please wait a bit and try again.";
  }
  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "An account already exists for this email.";
  }
  if (normalized.includes("password") && normalized.includes("weak")) {
    return "Password must be at least 8 characters and include lowercase, uppercase, number, and symbol.";
  }

  return error.status && error.status >= 500
    ? "Authentication is temporarily unavailable. Please try again."
    : "Unable to authenticate. Please check your details and try again.";
}

function readCredentials(
  formData: FormData,
  options: { enforcePasswordPolicy?: boolean; enforceSignupEmailDomain?: boolean } = {},
): { email: string; password: string } | { error: string } {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email and password are required." };
  }

  const cleanEmail = normalizeEmail(email);
  const emailError = options.enforceSignupEmailDomain
    ? getSignupEmailValidationError(email)
    : getEmailValidationError(email);
  if (emailError) return { error: emailError };

  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    return { error: "Enter a valid password." };
  }
  if (options.enforcePasswordPolicy) {
    const passwordError = getSignupPasswordError(password, cleanEmail);
    if (passwordError) return { error: passwordError };
  }

  return { email: cleanEmail, password };
}

function getEmailRedirectTo() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000";
  const normalized = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  return new URL("/login", normalized).toString();
}

function looksAutoConfirmed(user: { created_at?: string; email_confirmed_at?: string | null }) {
  if (!user.created_at || !user.email_confirmed_at) return false;
  const createdAt = Date.parse(user.created_at);
  const confirmedAt = Date.parse(user.email_confirmed_at);
  if (!Number.isFinite(createdAt) || !Number.isFinite(confirmedAt)) return false;
  return Math.abs(confirmedAt - createdAt) < 1_000;
}

export async function login(formData: FormData): Promise<AuthActionResult> {
  const rateLimit = await limitServerActionByIp("auth:login", 8, 60_000);
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Too many attempts. Please try again shortly." };

  const credentials = readCredentials(formData);
  if ("error" in credentials) return { error: credentials.error };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes("email not confirmed") || normalized.includes("not confirmed")) {
      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email: credentials.email,
        options: { emailRedirectTo: getEmailRedirectTo() },
      });
      if (resendErr) return { error: formatAuthError(resendErr) };
      return { status: "confirmation_required" as const };
    }
    return { error: formatAuthError(error) };
  }

  if (!data.user?.email_confirmed_at || looksAutoConfirmed(data.user)) {
    await supabase.auth.signOut();
    const { error: resendErr } = await supabase.auth.resend({
      type: "signup",
      email: credentials.email,
      options: { emailRedirectTo: getEmailRedirectTo() },
    });
    if (resendErr) return { error: formatAuthError(resendErr) };
    return { status: "confirmation_required" as const };
  }

  return { status: "authenticated" as const };
}

export async function signup(formData: FormData): Promise<AuthActionResult> {
  if (!SIGNUPS_ENABLED) {
    return { error: "Signups are paused. Join the waitlist to get early access." };
  }
  const rateLimit = await limitServerActionByIp("auth:signup", 4, 60_000);
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Too many attempts. Please try again shortly." };

  const credentials = readCredentials(formData, {
    enforcePasswordPolicy: true,
    enforceSignupEmailDomain: true,
  });
  if ("error" in credentials) return { error: credentials.error };

  const passwordConfirmation = formData.get("password_confirmation");
  if (typeof passwordConfirmation !== "string" || passwordConfirmation !== credentials.password) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: { emailRedirectTo: getEmailRedirectTo() },
  });
  if (error) return { error: formatAuthError(error) };

  // Supabase obfuscates existing-account responses: a fresh signup has
  // `identities.length > 0`, while a hit against an existing user (confirmed
  // or unconfirmed) returns identities = []. Probe with resend to find out
  // which: it succeeds for unconfirmed users and errors for confirmed ones.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    const { error: resendErr } = await supabase.auth.resend({
      type: "signup",
      email: credentials.email,
      options: { emailRedirectTo: getEmailRedirectTo() },
    });
    if (!resendErr) return { status: "confirmation_required" as const };
    const normalized = resendErr.message.toLowerCase();
    if (normalized.includes("already confirmed") || normalized.includes("already been confirmed")) {
      return { status: "already_confirmed" as const };
    }
    return { error: formatAuthError(resendErr) };
  }

  if (!data.session) return { status: "confirmation_required" as const };

  await supabase.auth.signOut();
  return {
    error:
      "Email confirmation is not enabled in Supabase. Enable it before accepting new accounts.",
  };
}

export async function verifyEmailOtp(formData: FormData): Promise<AuthActionResult> {
  const rateLimit = await limitServerActionByIp("auth:verify-otp", 8, 60_000);
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Too many attempts. Please try again shortly." };

  const email = formData.get("email");
  const token = formData.get("token");
  if (typeof email !== "string" || typeof token !== "string") {
    return { error: "Email and code are required." };
  }
  const cleanEmail = normalizeEmail(email);
  const cleanToken = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanToken)) {
    return { error: "Enter the 6-digit code from your email." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: "signup",
  });
  if (error) return { error: formatAuthError(error) };
  if (!data.session) return { error: "Unable to verify. Please try again." };

  return { status: "authenticated" as const };
}

export async function resendEmailOtp(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const rateLimit = await limitServerActionByIp("auth:resend-otp", 3, 60_000);
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Too many attempts. Please try again shortly." };

  const email = formData.get("email");
  if (typeof email !== "string") return { error: "Email is required." };
  const emailError = getEmailValidationError(email);
  if (emailError) return { error: emailError };
  const cleanEmail = normalizeEmail(email);

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: cleanEmail,
    options: { emailRedirectTo: getEmailRedirectTo() },
  });
  if (error) return { error: formatAuthError(error) };
  return { ok: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
