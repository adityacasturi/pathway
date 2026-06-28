import { updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";

/** Bust all shared catalog caches (feed, companies, industries, lookups, sectors). */
export function invalidateCatalogCacheTags(): void {
  for (const tag of Object.values(CACHE_TAGS)) {
    updateTag(tag);
  }
}
