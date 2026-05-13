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
  if (error) return { error: formatAuthError(error) };

  if (!data.user?.email_confirmed_at || looksAutoConfirmed(data.user)) {
    await supabase.auth.signOut();
    return { error: "Confirm your email before signing in." };
  }

  return { status: "authenticated" as const };
}

export async function signup(formData: FormData): Promise<AuthActionResult> {
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
    options: {
      emailRedirectTo: getEmailRedirectTo(),
    },
  });
  if (error) return { error: formatAuthError(error) };
  if (!data.session) return { status: "confirmation_required" as const };

  await supabase.auth.signOut();
  return {
    error:
      "Email confirmation is not enabled yet. Enable email confirmations in Supabase before accepting new accounts.",
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
