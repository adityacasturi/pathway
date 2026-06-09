import type { FeedPosting } from "@/lib/feed/types";
import type { ApplicationEvent, ApplicationSeason, Status } from "@/types/application";

export const CHAT_RESULT_LIMIT = 20;

export type ChatPresentation =
  | "company_card"
  | "company_list"
  | "posting_list"
  | "posting_card"
  | "application_list"
  | "application_detail"
  | "application_stats"
  | "empty_result";

export type ChatEmptyResultKind = "postings" | "applications" | "companies" | "saved_postings";

export type ChatEmptyResultSuggestion = {
  label: string;
  href: string;
};

export type ChatEmptyResult = {
  presentation: "empty_result";
  kind: ChatEmptyResultKind;
  title: string;
  message: string;
  searchSummary?: string;
  suggestions: ChatEmptyResultSuggestion[];
};

export type ChatApplicationSummary = {
  id: string;
  company: string;
  role: string;
  status: Status;
  location: string | null;
  season: ApplicationSeason | null;
  lastActivityDate: string;
  appliedDate: string | null;
  postingUrl: string | null;
};

export type SearchApplicationsInput = {
  company?: string;
  status?: Status;
  season?: ApplicationSeason | null;
  location?: string;
  datePreset?: "this_month" | "last_month" | "this_year" | "last_year" | "last_30_days";
  month?: string;
  year?: number;
  appliedAfter?: string;
  appliedBefore?: string;
  includeArchived?: boolean;
  sortBy?: "appliedDate" | "lastActivity" | "company";
  sortDirection?: "asc" | "desc";
  limit?: number;
};

export type ChatCompanyCatalogItem = {
  slug: string;
  name: string;
  industrySlug: string | null;
  industryLabel: string | null;
  openCount: number;
  websiteUrl: string | null;
};

export type ChatCompanyCardResult = {
  presentation: "company_card";
  company: ChatCompanyCatalogItem;
  openingsHref: string;
};

export type ChatCompanyListResult = {
  presentation: "company_list";
  title?: string;
  companies: ChatCompanyCatalogItem[];
};

export type ChatPostingListResult = {
  presentation: "posting_list";
  title: string;
  postings: FeedPosting[];
  totalCount: number;
  truncated: boolean;
  viewAllHref?: string;
};

export type ChatPostingCardResult = {
  presentation: "posting_card";
  posting: FeedPosting;
  viewAllHref?: string;
};

export type ChatApplicationListResult = {
  presentation: "application_list";
  title: string;
  applications: ChatApplicationSummary[];
  totalCount: number;
  truncated: boolean;
  viewAllHref?: string;
};

export type ChatApplicationEventSummary = {
  id: string;
  eventType: ApplicationEvent["event_type"];
  label: string;
  eventDate: string;
  notes: string | null;
};

export type ChatApplicationDetailResult = {
  presentation: "application_detail";
  application: ChatApplicationSummary;
  events: ChatApplicationEventSummary[];
  applicationsHref: string;
};

export type ChatApplicationStatsResult = {
  presentation: "application_stats";
  activeCount: number;
  archivedCount: number;
  stageCounts: Record<Status, number>;
};

export type ChatToolResult =
  | ChatCompanyCardResult
  | ChatCompanyListResult
  | ChatPostingListResult
  | ChatPostingCardResult
  | ChatApplicationListResult
  | ChatApplicationDetailResult
  | ChatApplicationStatsResult
  | ChatEmptyResult;

export type ChatThreadRow = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRow = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  parts: unknown;
  clientMessageId?: string | null;
  createdAt: string;
};

export type ChatToolAuditSummary = {
  presentation: ChatPresentation;
  title?: string;
  totalCount?: number;
  itemCount?: number;
  truncated?: boolean;
};

export type SearchPostingsInput = {
  company?: string;
  companySlug?: string;
  companySlugs?: string[];
  query?: string;
  keywords?: string;
  location?: string;
  industry?: string;
  season?: FeedPosting["season"];
  year?: number;
  remoteOnly?: boolean;
  limit?: number;
};
