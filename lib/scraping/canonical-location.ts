/**
 * Canonical place model for scraped postings.
 * Implementation lives in lib/geo — this module re-exports for backward compatibility.
 */

export type { CanonicalPlace } from "../geo/types.ts";

import {
  canonicalizeLocationParts,
  canonicalPlacesToField,
  canonicalPlacesToJson,
  canonicalizeScrapedLocationPart,
  formatCanonicalPlace,
  parseCanonicalPlace,
} from "../geo/server.ts";
import type { CanonicalPlace } from "../geo/types.ts";

export {
  formatCanonicalPlace,
  canonicalPlacesToField,
  canonicalPlacesToJson,
  parseCanonicalPlace,
  canonicalizeScrapedLocationPart,
};

export function canonicalizeScrapedLocationParts(rawParts: readonly string[]): CanonicalPlace[] {
  return canonicalizeLocationParts(rawParts).map((resolved) => resolved.place);
}
