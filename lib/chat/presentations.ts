import { STATUS_LABELS } from "@/lib/config/events";
import { buildPostingListTitle } from "./filter-summary.ts";
import type {
  ChatApplicationListResult,
  ChatEmptyResult,
  ChatPostingCardResult,
  ChatPostingListResult,
  ChatToolResult,
  SearchApplicationsInput,
  SearchPostingsInput,
} from "./types.ts";
import type { FeedPosting } from "@/lib/feed/types";
import type { Status } from "@/types/application";

export function applicationListTitle(totalCount: number, status?: Status): string {
  if (status) {
    const label = STATUS_LABELS[status].toLowerCase();
    if (totalCount === 0) return `0 ${label}`;
    return totalCount === 1 ? `1 ${label}` : `${totalCount} ${label}`;
  }
  return totalCount === 1 ? "1 application" : `${totalCount} applications`;
}

function buildSearchSummaryFromPostingFilters(filters: SearchPostingsInput): string {
  const parts: string[] = [];
  if (filters.company) parts.push(filters.company);
  if (filters.keywords) parts.push(filters.keywords);
  if (filters.location) parts.push(filters.location);
  if (filters.industry) parts.push(filters.industry);
  if (filters.season) parts.push(filters.season);
  if (filters.year) parts.push(String(filters.year));
  return parts.join(" · ") || "your search";
}

export function buildPostingSearchEmptyResult(
  filters: SearchPostingsInput,
): ChatEmptyResult {
  const searchSummary = buildSearchSummaryFromPostingFilters(filters);
  const suggestions: ChatEmptyResult["suggestions"] = [
    { label: "Browse all openings", href: "/openings" },
  ];

  if (filters.company) {
    suggestions.push({
      label: `Search all ${filters.company} roles`,
      href: `/openings?q=${encodeURIComponent(filters.company)}`,
    });
  } else if (filters.keywords) {
    suggestions.push({
      label: "Try a broader search",
      href: `/openings?q=${encodeURIComponent(filters.keywords)}`,
    });
  }

  suggestions.push({ label: "Set up email alerts", href: "/alerts" });

  return {
    presentation: "empty_result",
    kind: "postings",
    title: "No openings found",
    message: `Nothing open matches ${searchSummary} right now.`,
    searchSummary,
    suggestions,
  };
}

export function buildApplicationSearchEmptyResult(
  filters: Pick<SearchApplicationsInput, "company" | "status" | "season">,
): ChatEmptyResult {
  const parts: string[] = [];
  if (filters.status) parts.push(STATUS_LABELS[filters.status].toLowerCase());
  if (filters.company) parts.push(`at ${filters.company}`);
  if (filters.season) parts.push(filters.season);
  const searchSummary = parts.join(" ") || "your filters";

  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.season) params.set("season", filters.season);
  if (filters.company) params.set("q", filters.company);
  const applicationsHref = params.size > 0 ? `/applications?${params}` : "/applications";

  return {
    presentation: "empty_result",
    kind: "applications",
    title: "No applications found",
    message: `No tracked applications match ${searchSummary}.`,
    searchSummary,
    suggestions: [
      { label: "View all applications", href: "/applications" },
      { label: "Open Applications", href: applicationsHref },
      { label: "Browse openings", href: "/openings" },
    ],
  };
}

export function buildSavedPostingsEmptyResult(): ChatEmptyResult {
  return {
    presentation: "empty_result",
    kind: "saved_postings",
    title: "No saved roles",
    message: "You have not saved any openings yet.",
    suggestions: [
      { label: "Browse openings", href: "/openings" },
      { label: "Browse companies", href: "/companies" },
    ],
  };
}

export function buildApplicationDetailEmptyResult(company?: string): ChatEmptyResult {
  const label = company?.trim() || "that company";
  return {
    presentation: "empty_result",
    kind: "applications",
    title: "Application not found",
    message: `No tracked application found for ${label}.`,
    searchSummary: label,
    suggestions: [
      { label: "View applications", href: "/applications" },
      { label: "Browse openings", href: "/openings" },
    ],
  };
}

export function resolvePostingToolResult(options: {
  postings: FeedPosting[];
  totalCount: number;
  truncated: boolean;
  viewAllHref?: string;
  title?: string;
  filters?: SearchPostingsInput;
}): ChatToolResult {
  const { postings, totalCount, truncated, viewAllHref, title, filters } = options;

  if (totalCount === 0) {
    return buildPostingSearchEmptyResult(filters ?? {});
  }

  if (totalCount === 1 && postings.length === 1) {
    const card: ChatPostingCardResult = {
      presentation: "posting_card",
      posting: postings[0]!,
      viewAllHref,
    };
    return card;
  }

  const list: ChatPostingListResult = {
    presentation: "posting_list",
    title: title ?? buildPostingListTitle(totalCount),
    postings,
    totalCount,
    truncated,
    viewAllHref,
  };
  return list;
}

export function buildApplicationListResult(options: {
  applications: ChatApplicationListResult["applications"];
  totalCount: number;
  truncated: boolean;
  viewAllHref?: string;
  filters?: Pick<SearchApplicationsInput, "company" | "status" | "season">;
}): ChatToolResult {
  if (options.totalCount === 0) {
    return buildApplicationSearchEmptyResult(options.filters ?? {});
  }

  return {
    presentation: "application_list",
    title: applicationListTitle(options.totalCount, options.filters?.status),
    applications: options.applications,
    totalCount: options.totalCount,
    truncated: options.truncated,
    viewAllHref: options.viewAllHref,
  };
}
