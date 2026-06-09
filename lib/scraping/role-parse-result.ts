import type { RoleParseResult, RoleRejection, ScrapedRole } from "./types.ts";

/** Deduplicate kept roles by posting URL (last wins). */
export function dedupeScrapeRoles(roles: ScrapedRole[]): ScrapedRole[] {
  const byUrl = new Map<string, ScrapedRole>();
  for (const role of roles) {
    byUrl.set(role.postingUrl, role);
  }
  return Array.from(byUrl.values());
}

/** Build adapter parse output. */
export function buildRoleParseResult(
  fetched: number,
  roles: ScrapedRole[],
  rejected: RoleRejection[],
): RoleParseResult {
  const deduped = dedupeScrapeRoles(roles);
  return {
    roles: deduped,
    stats: {
      fetched,
      kept: deduped.length,
      rejected,
    },
  };
}
