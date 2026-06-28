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
  offices?: Array<{
    name?: string;
    location?: string;
  }>;
  departments?: Array<{ name?: string }>;
  metadata?: Array<{
    name?: string;
    value?: string | string[] | null;
  }>;
  updated_at?: string;
  first_published?: string;
}

/** Flatten Greenhouse metadata values (single_select and multi_select). */
export function flattenGreenhouseMetadataValues(value: string | string[] | null | undefined): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => flattenGreenhouseMetadataValues(entry));
}

export function parseGreenhouseEmploymentMetadata(
  metadata: GreenhouseBoardJob["metadata"],
): { employmentType: string | null; commitment: string | null } {
  let employmentType: string | null = null;
  let commitment: string | null = null;

  for (const item of metadata ?? []) {
    const label = item.name?.trim().toLowerCase() ?? "";
    const values = flattenGreenhouseMetadataValues(item.value);
    if (values.length === 0) {
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
      employmentType ??= values[0] ?? null;
    }
    if (
      label.includes("commitment") ||
      label.includes("duration") ||
      label.includes("season") ||
      label.includes("program") ||
      label === "time type" ||
      label === "term length"
    ) {
      commitment ??= values[0] ?? null;
    }
  }

  return { employmentType, commitment };
}
