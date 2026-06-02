/**
 * Shared Greenhouse Job Board API shapes and field parsers.
 * Used by greenhouse, coinbase, jane_street, replicate, and other GH-backed boards.
 */

export interface GreenhouseBoardJob {
  id: string | number;
  title?: string;
  absolute_url?: string;
  content?: string;
  location?: {
    name?: string;
  };
  departments?: Array<{ name?: string }>;
  metadata?: Array<{
    name?: string;
    value?: string | null;
  }>;
  updated_at?: string;
  first_published?: string;
}

export function parseGreenhouseEmploymentMetadata(
  metadata: GreenhouseBoardJob["metadata"],
): { employmentType: string | null; commitment: string | null } {
  let employmentType: string | null = null;
  let commitment: string | null = null;

  for (const item of metadata ?? []) {
    const label = item.name?.trim().toLowerCase() ?? "";
    const value = typeof item.value === "string" ? item.value.trim() : "";
    if (!value) {
      continue;
    }

    if (
      label.includes("employment type") ||
      label === "time type" ||
      label === "job type" ||
      label === "position type" ||
      label === "worker type" ||
      label === "worker sub-type"
    ) {
      employmentType ??= value;
    }
    if (
      label.includes("commitment") ||
      label.includes("duration") ||
      label.includes("season") ||
      label.includes("program") ||
      label === "time type" ||
      label === "term length"
    ) {
      commitment ??= value;
    }
  }

  return { employmentType, commitment };
}
