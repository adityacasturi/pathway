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
  return getSiteRedirectTo("/login");
}

function getPasswordResetRedirectTo() {
  return getSiteRedirectTo("/set-password");
}

function getSiteRedirectTo(path: string) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000";
  const normalized = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  return new URL(path, normalized).toString();
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

  // Old unconfirmed accounts (from before email confirmation was disabled)
  // still need to verify via OTP — auto-resend a code and route them through
  // the OTP screen.
  if (!data.user?.email_confirmed_at) {
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
    return { error: "Signups are paused. Please check back soon." };
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

  // Supabase obfuscates existing-account responses to prevent email
  // enumeration: a fresh signup has `identities.length > 0`, while a hit
  // against an existing user (confirmed or unconfirmed) returns identities = [].
  // Reject re-registration outright; unconfirmed users can recover via /login,
  // which auto-resends a confirmation code on "Email not confirmed".
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: "An account already exists for this email. Try signing in instead." };
  }

  // Email confirmation is currently disabled in the Supabase project, so a
  // fresh signup returns a session and we authenticate immediately. If
  // confirmation is later re-enabled, fall back to the OTP flow — the UI and
  // verifyEmailOtp/resendEmailOtp actions are still wired up for that case.
  if (data.session) return { status: "authenticated" as const };
  return { status: "confirmation_required" as const };
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
  if (!SIGNUPS_ENABLED) {
    return { error: "Signups are paused. Please check back soon." };
  }
  const rateLimit = await limitServerActionByIp("auth:resend-otp", 3, 60_000);
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Too many attempts. Please try again shortly." };

  const email = formData.get("email");
  if (typeof email !== "string") return { error: "Email is required." };
  const emailError = getSignupEmailValidationError(email);
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

export async function sendPasswordReset(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const rateLimit = await limitServerActionByIp("auth:password-reset", 4, 60_000);
  if (!rateLimit.ok) {
    return { error: rateLimit.error ?? "Too many attempts. Please try again shortly." };
  }

  const email = formData.get("email");
  if (typeof email !== "string") return { error: "Enter your email first." };
  const emailError = getEmailValidationError(email);
  if (emailError) return { error: emailError };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: getPasswordResetRedirectTo(),
  });
  if (error) return { error: formatAuthError(error) };

  return { ok: true };
}

export async function setPassword(formData: FormData): Promise<AuthActionResult> {
  const rateLimit = await limitServerActionByIp("auth:set-password", 8, 60_000);
  if (!rateLimit.ok) {
    return { error: rateLimit.error ?? "Too many attempts. Please try again shortly." };
  }

  const password = formData.get("password");
  const passwordConfirmation = formData.get("password_confirmation");
  if (typeof password !== "string" || typeof passwordConfirmation !== "string") {
    return { error: "Password is required." };
  }
  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    return { error: "Enter a valid password." };
  }
  if (password !== passwordConfirmation) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your invite link has expired. Please request a new one." };
  }

  const passwordError = getSignupPasswordError(password, user.email ?? "");
  if (passwordError) return { error: passwordError };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: formatAuthError(error) };

  return { status: "authenticated" as const };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
