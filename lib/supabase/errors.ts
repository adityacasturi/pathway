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
  throw new Error(`${label} failed${suffix}: ${error.message}`);
}

