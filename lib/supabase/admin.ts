import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. This bypasses RLS and must only ever run in a
 * trusted server context (Route Handlers, cron, server-only modules, and CLI
 * scripts). The tripwire below is a runtime guard: it is a no-op under Node and
 * React Server Components (no `window`) but throws immediately if this is ever
 * reached from a browser bundle, where the service-role key must never appear.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must never be called in the browser");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
