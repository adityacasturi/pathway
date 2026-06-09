import { classifyScrapeRole, type RoleClassification, type ScrapeRoleCandidate } from "./classify-role.ts";
import { buildScrapedRole } from "./scraped-role-build.ts";
import { buildRoleParseResult } from "./role-parse-result.ts";
import type { InferSeasonHints } from "./season.ts";
import type { RoleParseResult, RoleRejection, ScrapedRole } from "./types.ts";
import { isHttpUrl } from "./adapters/shared.ts";

export interface AdapterParseContext {
  companyName: string;
  companySlug?: string | null;
}

export interface AppendClassifiedRoleInput extends ScrapeRoleCandidate {
  postingUrl: string;
  roleName: string;
  description?: string | null;
  seasonHints?: InferSeasonHints;
}

export type AppendClassifiedRoleResult =
  | { ok: true; role: ScrapedRole }
  | { ok: false; rejection: RoleRejection };

/** Classify one posting and build a scraped role row, or return a rejection reason. */
export function appendClassifiedRole(
  input: AppendClassifiedRoleInput,
  context: AdapterParseContext,
): AppendClassifiedRoleResult {
  const roleName = input.roleName.trim();
  const postingUrl = input.postingUrl.trim();

  const classification = classifyScrapeRole({
    ...input,
    title: roleName,
    companyName: context.companyName,
    companySlug: context.companySlug,
  });

  if (!classification.include) {
    return {
      ok: false,
      rejection: {
        title: roleName || "(untitled)",
        reason: classification.reason,
      },
    };
  }

  if (!postingUrl || !isHttpUrl(postingUrl)) {
    return {
      ok: false,
      rejection: { title: roleName, reason: "invalid_url" },
    };
  }

  return {
    ok: true,
    role: buildScrapedRole({
      postingUrl,
      roleName,
      companyName: context.companyName,
      companySlug: context.companySlug,
      classification,
      description: input.description,
      seasonHints: input.seasonHints,
    }),
  };
}

/** Standard adapter output after iterating postings. */
export function finishAdapterParse(
  fetched: number,
  roles: ScrapedRole[],
  rejected: RoleRejection[],
): RoleParseResult {
  return buildRoleParseResult(fetched, roles, rejected);
}

/** Classify with company context for location invalid-token rules. */
export function classifyForSource(
  source: { companyName: string; companySlug?: string | null },
  candidate: Omit<ScrapeRoleCandidate, "companyName" | "companySlug">,
): RoleClassification {
  return classifyScrapeRole({
    ...candidate,
    companyName: source.companyName,
    companySlug: source.companySlug,
  });
}
