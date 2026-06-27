import { cache } from "react";
import { createClient } from "./server";

/** Request-scoped session lookup (deduped across layout, pages, and nested RSCs). */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});
