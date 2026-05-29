export function isMissingPreferenceColumnError(
  error: { code?: string; message?: string } | null,
  column: string,
): boolean {
  return Boolean(
    error &&
      error.code === "42703" &&
      error.message?.toLowerCase().includes(column.toLowerCase()),
  );
}
