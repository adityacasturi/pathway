import { logServerEvent } from "@/lib/observability";

interface SupabaseLikeError {
  message: string;
  code?: string;
}

export function assertSupabaseOk(
  error: SupabaseLikeError | null,
  label: string,
): asserts error is null {
  if (!error) return;
  const suffix = error.code ? ` (${error.code})` : "";
  logServerEvent({
    level: "error",
    event: "supabase.query_error",
    message: error.message,
    code: error.code,
    meta: { label },
  });
  throw new Error(`${label} failed${suffix}: ${error.message}`);
}

export function formatSupabaseMutationError(
  error: SupabaseLikeError,
  fallback = "Unable to save changes. Please try again.",
): string {
  const message = error.message.trim();
  const normalized = message.toLowerCase();

  logServerEvent({
    level: "warn",
    event: "supabase.mutation_error",
    message,
    code: error.code,
  });

  if (normalized.includes("too many attempts")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (normalized.includes("not authenticated")) {
    return "Not authenticated.";
  }
  if (normalized.includes("application not found")) {
    return "Application not found.";
  }
  if (normalized.includes("applied event cannot be deleted")) {
    return "The applied event is required and cannot be deleted.";
  }
  if (normalized.includes("application status must match its event history")) {
    return "Application status must match its event history.";
  }
  if (normalized.includes("invalid rate limit bucket")) {
    return "That action is not rate-limit eligible.";
  }
  if (normalized.includes("deadlines can only be added to oa events")) {
    return "Deadlines can only be added to OA events.";
  }
  if (normalized.includes("notes are too long")) {
    return "Notes are too long.";
  }
  if (normalized.includes("invalid event type")) {
    return "Invalid event type.";
  }

  if (error.code === "23505") {
    return "That item already exists.";
  }
  if (error.code === "23514" || error.code === "22001" || error.code === "22P02") {
    return "Some fields are invalid. Please review and try again.";
  }
  if (error.code === "42501") {
    return "You do not have permission to make that change.";
  }

  return fallback;
}
