import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedSeason } from "@/lib/feed/types";
import {
  buildApplicationDetailEmptyResult,
  buildApplicationListResult,
  buildSavedPostingsEmptyResult,
  resolvePostingToolResult,
} from "./presentations.ts";
import {
  getApplicationStatsForChat,
  loadCompanyCatalogForChat,
  loadSavedPostingsForChat,
  resolveApplicationForChat,
  resolveCompaniesForChat,
  resolveCompaniesFromCatalog,
  searchApplicationsForChat,
  searchPostingsForChat,
  toChatApplicationDetail,
} from "./queries.ts";
import {
  isCompanyOpeningBrowseQuestion,
  resolveIndustrySlugFromQuery,
  sanitizeCompanyFilter,
  sanitizeIndustryFilter,
  userMentionedIndustryInMessage,
  userMentionedSeasonInMessage,
  userMentionedYearInMessage,
  userNamedCompanyInMessage,
} from "./resolution.ts";
import type { ChatToolResult, SearchPostingsInput } from "./types.ts";
import { type ChatToolAuditContext, withChatToolAudit } from "./tool-audit.ts";

export type ChatSearchContext = {
  latestUserMessage?: string;
};

const feedSeasonSchema = z.enum(["Summer", "Fall", "Spring", "Winter"]);

function normalizeFeedSeason(season: string | undefined): FeedSeason | undefined {
  if (!season?.trim()) return undefined;
  const normalized = `${season.trim().charAt(0).toUpperCase()}${season.trim().slice(1).toLowerCase()}`;
  return feedSeasonSchema.safeParse(normalized).success
    ? (normalized as FeedSeason)
    : undefined;
}

function openingsHrefForCompany(name: string): string {
  return `/openings?q=${encodeURIComponent(name)}`;
}

function applicationsHref(filters: {
  company?: string;
  status?: string;
  season?: string;
}): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.season) params.set("season", filters.season);
  if (filters.company) params.set("q", filters.company);
  const query = params.toString();
  return query ? `/applications?${query}` : "/applications";
}

function buildSearchRolesFilters(options: {
  input: {
    company?: string;
    query?: string;
    keywords?: string;
    location?: string;
    industry?: string;
    season?: string;
    year?: number;
    limit?: number;
  };
  userMessage?: string;
  companySlug?: string;
  companyName?: string;
}): SearchPostingsInput {
  const userMessage = options.userMessage?.trim();
  const topic = options.input.query?.trim() || options.input.keywords?.trim();

  return {
    company: options.companyName,
    companySlug: options.companySlug,
    location: options.input.location?.trim() || undefined,
    industry: userMentionedIndustryInMessage(userMessage)
      ? sanitizeIndustryFilter(options.input.industry)
      : undefined,
    season: userMentionedSeasonInMessage(userMessage)
      ? normalizeFeedSeason(options.input.season)
      : undefined,
    year: userMentionedYearInMessage(userMessage) ? options.input.year : undefined,
    keywords: topic,
    limit: options.input.limit,
  };
}

async function resolveCompanyForRoleSearch(
  supabase: SupabaseClient,
  company: string | undefined,
): Promise<
  | { kind: "resolved"; companySlug: string; companyName: string }
  | { kind: "ambiguous"; companies: Awaited<ReturnType<typeof resolveCompaniesForChat>> }
  | { kind: "none" }
> {
  const query = sanitizeCompanyFilter(company);
  if (!query) return { kind: "none" };

  const catalog = await loadCompanyCatalogForChat(supabase);
  const matches = resolveCompaniesFromCatalog(catalog, query, 5);

  if (matches.length === 1) {
    return {
      kind: "resolved",
      companySlug: matches[0]!.slug,
      companyName: matches[0]!.name,
    };
  }

  if (matches.length > 1) {
    return { kind: "ambiguous", companies: matches };
  }

  return { kind: "none" };
}

const applicationStatusSchema = z.enum(["applied", "oa", "interview", "offer", "rejected"]);
const applicationSeasonSchema = z.enum(["Summer", "Fall", "Spring", "Winter"]);
const applicationDatePresetSchema = z.enum([
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "last_30_days",
]);

export function chatTools(
  supabase: SupabaseClient,
  auditContext?: ChatToolAuditContext,
  searchContext?: ChatSearchContext,
) {
  const userId = auditContext?.userId;

  const tools = {
    searchRoles: tool({
      description:
        "Search open internship roles. Use for every opening question, including 'does X have open roles', 'any internships at Y', and topic searches. Pass company when the user names an employer.",
      inputSchema: z.object({
        company: z.string().optional().describe("Employer name, e.g. NVIDIA, Google, HRT."),
        query: z
          .string()
          .optional()
          .describe("Search terms matched against role title, company, and location."),
        keywords: z.string().optional().describe("Alias for query."),
        location: z.string().optional(),
        industry: z.string().optional(),
        season: z.string().optional().describe("Summer, Fall, Spring, or Winter."),
        year: z.number().int().min(1900).max(2200).optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async (input): Promise<ChatToolResult> => {
        const userMessage = searchContext?.latestUserMessage;

        let companyInput = input.company?.trim();
        if (!companyInput && userMessage?.trim()) {
          const catalog = await loadCompanyCatalogForChat(supabase);
          const inferred = resolveCompaniesFromCatalog(catalog, userMessage, 5);
          const openingAvailabilityQuestion =
            /\b(open(ings?)?|roles?|jobs?|internships?|positions?|hiring|listings?|available)\b/i.test(
              userMessage,
            );
          if (
            inferred.length === 1 &&
            userNamedCompanyInMessage(inferred[0]!.name, userMessage) &&
            (isCompanyOpeningBrowseQuestion(userMessage, inferred[0]!.name) ||
              openingAvailabilityQuestion)
          ) {
            companyInput = inferred[0]!.name;
          }
        }

        const keepCompany =
          !companyInput ||
          !userMessage?.trim() ||
          userNamedCompanyInMessage(companyInput, userMessage);

        const companyResolution =
          companyInput && keepCompany
            ? await resolveCompanyForRoleSearch(supabase, companyInput)
            : { kind: "none" as const };

        if (companyResolution.kind === "ambiguous") {
          return {
            presentation: "company_list",
            title: "Which company?",
            companies: companyResolution.companies,
          };
        }

        const filters = buildSearchRolesFilters({
          input,
          userMessage,
          companySlug:
            companyResolution.kind === "resolved" ? companyResolution.companySlug : undefined,
          companyName:
            companyResolution.kind === "resolved" ? companyResolution.companyName : undefined,
        });

        const result = await searchPostingsForChat(supabase, filters);

        const resolvedCompany =
          companyResolution.kind === "resolved" ? companyResolution.companyName : filters.company;
        const viewAllHref = resolvedCompany
          ? openingsHrefForCompany(resolvedCompany)
          : result.truncated
            ? "/openings"
            : undefined;

        return resolvePostingToolResult({
          postings: result.postings,
          totalCount: result.totalCount,
          truncated: result.truncated,
          viewAllHref,
          filters,
        });
      },
    }),

    searchCompanies: tool({
      description:
        "Browse employers by name or industry. Do not use for 'does X have open roles' — use searchRoles instead.",
      inputSchema: z.object({
        query: z.string().optional(),
        industry: z.string().optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async (input): Promise<ChatToolResult> => {
        const userMessage = searchContext?.latestUserMessage;
        const catalog = await loadCompanyCatalogForChat(supabase);
        let query = input.query?.trim();
        const industry = userMentionedIndustryInMessage(userMessage)
          ? sanitizeIndustryFilter(input.industry)
          : undefined;

        if (industry && query && resolveIndustrySlugFromQuery(query) === industry) {
          query = undefined;
        }

        let companies = query
          ? resolveCompaniesFromCatalog(catalog, query, input.limit ?? 12)
          : catalog;

        if (industry) {
          companies = companies.filter((company) => company.industrySlug === industry);
        }

        companies = companies
          .sort((left, right) => right.openCount - left.openCount || left.name.localeCompare(right.name))
          .slice(0, input.limit ?? 12);

        return {
          presentation: "company_list",
          title: "Companies",
          companies,
        };
      },
    }),

    searchApplications: tool({
      description:
        "List the user's tracked applications with optional filters. Use for who/which/where/list questions about applications, including by status (rejected, offer, interview, etc.). Returns an application list block — not just counts.",
      inputSchema: z.object({
        company: z.string().optional().describe("Employer name, e.g. NVIDIA, Google."),
        status: applicationStatusSchema.optional().describe("Pipeline stage filter, e.g. rejected."),
        season: applicationSeasonSchema.optional(),
        location: z.string().optional(),
        datePreset: applicationDatePresetSchema.optional(),
        month: z.string().optional().describe("YYYY-MM applied month filter."),
        year: z.number().int().min(1900).max(2200).optional(),
        includeArchived: z.boolean().optional(),
        sortBy: z.enum(["appliedDate", "lastActivity", "company"]).optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async (input): Promise<ChatToolResult> => {
        if (!userId) {
          throw new Error("Unauthorized");
        }

        const result = await searchApplicationsForChat(supabase, userId, input);
        return buildApplicationListResult({
          applications: result.applications,
          totalCount: result.totalCount,
          truncated: result.truncated,
          viewAllHref: applicationsHref({
            company: input.company,
            status: input.status,
            season: input.season,
          }),
          filters: {
            company: input.company,
            status: input.status,
            season: input.season,
          },
        });
      },
    }),

    getApplication: tool({
      description:
        "Look up one tracked application by company name and return its event timeline. Use for questions about a specific application. For lists of multiple applications, use searchApplications instead.",
      inputSchema: z.object({
        company: z.string().describe("Employer name for the application, e.g. NVIDIA, Google."),
      }),
      execute: async (input): Promise<ChatToolResult> => {
        if (!userId) {
          throw new Error("Unauthorized");
        }

        const resolution = await resolveApplicationForChat(supabase, userId, {
          company: input.company,
        });

        if (resolution.kind === "none") {
          return buildApplicationDetailEmptyResult(input.company);
        }

        if (resolution.kind === "multiple") {
          return buildApplicationListResult({
            applications: resolution.applications,
            totalCount: resolution.applications.length,
            truncated: false,
            filters: { company: input.company },
          });
        }

        return toChatApplicationDetail(resolution.application);
      },
    }),

    getApplicationStats: tool({
      description:
        "Return only aggregate pipeline counts (active, archived, stage totals). Does not list company names. Use for overall pipeline summary questions — not for listing which companies or applications.",
      inputSchema: z.object({}),
      execute: async (): Promise<ChatToolResult> => {
        if (!userId) {
          throw new Error("Unauthorized");
        }

        const stats = await getApplicationStatsForChat(supabase, userId);
        return {
          presentation: "application_stats",
          activeCount: stats.activeCount,
          archivedCount: stats.archivedCount,
          stageCounts: stats.stageCounts,
        };
      },
    }),

    listSavedRoles: tool({
      description:
        "List internship roles the user saved from Openings. Use for saved/bookmarked/for-later role questions.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async (input): Promise<ChatToolResult> => {
        if (!userId) {
          throw new Error("Unauthorized");
        }

        const result = await loadSavedPostingsForChat(supabase, userId, input.limit);
        if (result.totalCount === 0) {
          return buildSavedPostingsEmptyResult();
        }

        return resolvePostingToolResult({
          postings: result.postings,
          totalCount: result.totalCount,
          truncated: result.truncated,
          viewAllHref: "/openings",
          title: result.totalCount === 1 ? "1 saved role" : `${result.totalCount} saved roles`,
        });
      },
    }),

    getCompany: tool({
      description:
        "Look up one employer by name. Use for company info only — still call searchRoles to list openings.",
      inputSchema: z.object({
        name: z.string().describe("Company name, e.g. Hudson River Trading, Google, HRT."),
      }),
      execute: async (input): Promise<ChatToolResult> => {
        const query = sanitizeCompanyFilter(input.name);
        if (!query) {
          return { presentation: "company_list", title: "Companies", companies: [] };
        }

        const matches = await resolveCompaniesForChat(supabase, query, 5);

        if (matches.length === 0) {
          return { presentation: "company_list", title: "Companies", companies: [] };
        }

        if (matches.length === 1) {
          const company = matches[0]!;
          return {
            presentation: "company_card",
            company,
            openingsHref: openingsHrefForCompany(company.name),
          };
        }

        return {
          presentation: "company_list",
          title: "Matching companies",
          companies: matches,
        };
      },
    }),
  };

  return withChatToolAudit(supabase, tools, auditContext);
}

export type ChatTools = ReturnType<typeof chatTools>;
