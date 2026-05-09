"use server";

import { createClient } from "@/lib/supabase/server";
import { limitServerActionByIp } from "@/lib/rate-limit";
import { redirect } from "next/navigation";

const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;

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
    return "Supabase is rate limiting confirmation emails. Wait a bit, or manually confirm this test user in Supabase.";
  }

  return message;
}

function readCredentials(formData: FormData): { email: string; password: string } | { error: string } {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email and password are required." };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > MAX_EMAIL_LENGTH) {
    return { error: "Enter a valid email address." };
  }
  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    return { error: "Enter a valid password." };
  }

  return { email: cleanEmail, password };
}

export async function login(formData: FormData): Promise<AuthActionResult> {
  const rateLimit = await limitServerActionByIp("auth:login", 8, 60_000);
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Too many attempts. Please try again shortly." };

  const credentials = readCredentials(formData);
  if ("error" in credentials) return { error: credentials.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) return { error: formatAuthError(error) };
  return { status: "authenticated" as const };
}

export async function signup(formData: FormData): Promise<AuthActionResult> {
  const rateLimit = await limitServerActionByIp("auth:signup", 4, 60_000);
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Too many attempts. Please try again shortly." };

  const credentials = readCredentials(formData);
  if ("error" in credentials) return { error: credentials.error };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) return { error: formatAuthError(error) };
  if (!data.session) return { status: "confirmation_required" as const };
  return { status: "authenticated" as const };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
