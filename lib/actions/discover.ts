"use server";

import { loadDiscoverCompanyPostings } from "@/lib/discover/companies";
import type { ScrapedPostingRow } from "@/lib/discover/types";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/observability";
import { limitServerActionByIp } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FAVORITE_RATE_LIMIT_REQUESTS = 120;
const FAVORITE_RATE_LIMIT_WINDOW_MS = 60_000;

const POSTINGS_RATE_LIMIT_REQUESTS = 240;
const POSTINGS_RATE_LIMIT_WINDOW_MS = 60_000;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

async function limitDiscoverFavoriteWrite() {
  return limitServerActionByIp(
    "discover-company-favorites:write",
    FAVORITE_RATE_LIMIT_REQUESTS,
    FAVORITE_RATE_LIMIT_WINDOW_MS,
  );
}

export async function fetchDiscoverCompanyPostings(
  companyId: string,
): Promise<{ postings: ScrapedPostingRow[] } | { error: string }> {
  if (!isUuid(companyId)) {
    return { error: "Invalid company." };
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Sign in to view listings." };
  }

  // Authenticated, but throttle to stop a single client from amplifying reads.
  const rateLimit = await limitServerActionByIp(
    "discover-company-postings:read",
    POSTINGS_RATE_LIMIT_REQUESTS,
    POSTINGS_RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimit.ok) {
    return { error: rateLimit.error ?? "Too many requests. Please wait a moment." };
  }

  try {
    const supabase = await createClient();
    const postings = await loadDiscoverCompanyPostings(supabase, companyId);
    return { postings };
  } catch (error) {
    console.error(
      JSON.stringify({
        app: "pathway",
        level: "error",
        event: "discover_company_postings_load_failed",
        message: errorMessage(error),
        at: new Date().toISOString(),
      }),
    );
    return { error: "Could not load listings." };
  }
}

export async function starDiscoverCompany(
  companyId: string,
): Promise<{ ok: true } | { error: string }> {
  const rateLimit = await limitDiscoverFavoriteWrite();
  if (!rateLimit.ok) {
    return {
      error:
        rateLimit.error ?? "Too many attempts. Please wait a moment and try again.",
    };
  }

  if (!isUuid(companyId)) {
    return { error: "Invalid company." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Sign in to star companies." };
  }
  const { error } = await supabase.from("discover_company_favorites").insert({
    user_id: user.id,
    company_id: companyId,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: true };
    }
    return {
      error: formatSupabaseMutationError(error, "Unable to star company."),
    };
  }

  return { ok: true };
}

export async function unstarDiscoverCompany(
  companyId: string,
): Promise<{ ok: true } | { error: string }> {
  const rateLimit = await limitDiscoverFavoriteWrite();
  if (!rateLimit.ok) {
    return {
      error:
        rateLimit.error ?? "Too many attempts. Please wait a moment and try again.",
    };
  }

  if (!isUuid(companyId)) {
    return { error: "Invalid company." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return { error: "Sign in to manage starred companies." };
  }
  const { error } = await supabase
    .from("discover_company_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("company_id", companyId);

  if (error) {
    return {
      error: formatSupabaseMutationError(error, "Unable to unstar company."),
    };
  }

  return { ok: true };
}
