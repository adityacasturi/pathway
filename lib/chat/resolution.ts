import type { SearchPostingsInput } from "./types.ts";
import { formatResolvedLocationFilter } from "./location-match.ts";
import { getSearchTerms } from "@/lib/search-terms";

export function normalizeCompanyQuery(company: string | undefined): string {
  return (company ?? "").trim().toLowerCase();
}

const COMPANY_QUERY_STOP_WORDS = new Set([
  "all",
  "any",
  "app",
  "apps",
  "application",
  "applications",
  "applied",
  "at",
  "for",
  "in",
  "i",
  "im",
  "am",
  "interested",
  "intern",
  "internship",
  "internships",
  "job",
  "jobs",
  "my",
  "open",
  "openings",
  "role",
  "roles",
  "the",
  "there",
  "are",
]);

const SEASON_QUERY_STOP_WORDS = new Set(["summer", "fall", "spring", "winter"]);

const COMPANY_SUFFIX_WORDS = new Set(["co", "corp", "corporation", "inc", "incorporated", "llc", "ltd"]);

const GENERIC_COMPANY_TOKENS = new Set([
  "capital",
  "partners",
  "group",
  "research",
  "trading",
  "technologies",
  "technology",
  "tech",
  "management",
  "holdings",
  "labs",
  "software",
]);

function distinctiveCompanyTokens(tokens: string[]): string[] {
  const distinctive = tokens.filter((token) => !GENERIC_COMPANY_TOKENS.has(token));
  return distinctive.length > 0 ? distinctive : tokens;
}

export function companyTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !COMPANY_SUFFIX_WORDS.has(token));
}

export function sanitizeCompanyFilter(company: string | undefined): string | undefined {
  const tokens = companyTokens(company ?? "").filter(
    (token) => !COMPANY_QUERY_STOP_WORDS.has(token) && !SEASON_QUERY_STOP_WORDS.has(token),
  );
  return tokens.length > 0 ? tokens.join(" ") : undefined;
}

function companyNameMatchesNormalized(haystack: string, normalizedQuery: string): boolean {
  const normalizedHaystack = companyTokens(haystack).join(" ");

  if (normalizedHaystack.includes(normalizedQuery)) {
    return true;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const haystackTokens = new Set(normalizedHaystack.split(/\s+/).filter(Boolean));
  const tokensToMatch = distinctiveCompanyTokens(queryTokens);

  if (tokensToMatch.length === 1) {
    const token = tokensToMatch[0]!;
    if (token.length >= 2 && haystackTokens.has(token)) {
      return true;
    }
    return [...haystackTokens].some(
      (haystackToken) =>
        haystackToken.startsWith(token) || token.startsWith(haystackToken),
    );
  }

  return tokensToMatch.every((token) => {
    if (token.length < 2) return false;
    if (haystackTokens.has(token)) return true;
    return [...haystackTokens].some(
      (haystackToken) =>
        haystackToken.startsWith(token) || token.startsWith(haystackToken),
    );
  });
}

export function companyQueryVariants(query: string): string[] {
  const base = sanitizeCompanyFilter(query);
  if (!base) return [];

  const variants = new Set<string>([base]);
  const tokens = base.split(/\s+/).filter(Boolean);

  if (tokens.length > 1) {
    variants.add(tokens.join(""));
  }

  return [...variants];
}

export function companyNameMatches(haystack: string, query: string): boolean {
  return companyQueryVariants(query).some((variant) =>
    companyNameMatchesNormalized(haystack, variant),
  );
}

const LOCATION_QUERY_STOP_WORDS = new Set([
  "only",
  "in",
  "near",
  "location",
  "locations",
]);

const POSTING_KEYWORD_STOP_WORDS = new Set([
  "a",
  "an",
  "all",
  "any",
  "find",
  "intern",
  "internship",
  "internships",
  "job",
  "jobs",
  "opening",
  "openings",
  "please",
  "role",
  "roles",
  "show",
  "the",
]);

export function sanitizeIndustryFilter(industry: string | undefined): string | undefined {
  const trimmed = industry?.trim();
  return trimmed ? trimmed : undefined;
}

export function userMentionedSeasonInMessage(message: string | undefined): boolean {
  if (!message?.trim()) return false;
  return /\b(summer|fall|spring|winter)\b/i.test(message);
}

export function userMentionedYearInMessage(message: string | undefined): boolean {
  if (!message?.trim()) return false;
  return /\b(19|20)\d{2}\b/.test(message);
}

export function userMentionedIndustryInMessage(message: string | undefined): boolean {
  if (!message?.trim()) return false;
  return resolveIndustrySlugFromQuery(message) !== undefined;
}

const OPENING_QUESTION_PATTERN =
  /\b(open(ings?)?|roles?|jobs?|internships?|positions?|hiring|listings?|available)\b/i;

const OPENING_QUESTION_FILLER = new Set([
  "any",
  "are",
  "at",
  "available",
  "does",
  "do",
  "have",
  "there",
  "what",
  "which",
  "open",
  "openings",
  "opening",
  "roles",
  "role",
  "jobs",
  "job",
  "internships",
  "internship",
  "positions",
  "position",
  "hiring",
  "listings",
  "listing",
]);

export function isCompanyOpeningBrowseQuestion(
  userMessage: string | undefined,
  companyName?: string,
): boolean {
  const message = userMessage?.trim();
  if (!message || !OPENING_QUESTION_PATTERN.test(message)) {
    return false;
  }

  let remainder = message;
  if (companyName?.trim()) {
    remainder = remainder.replace(new RegExp(companyName.trim(), "gi"), " ");
  }

  const topicTerms = sanitizePostingKeywords(remainder)
    ?.split(/\s+/)
    .filter(Boolean)
    .filter((term) => !OPENING_QUESTION_FILLER.has(term));

  return !topicTerms || topicTerms.length === 0;
}

export function sanitizeLocationFilter(location: string | undefined): string | undefined {
  const terms = getSearchTerms(location ?? "").filter((term) => !LOCATION_QUERY_STOP_WORDS.has(term));
  return terms.length > 0 ? terms.join(" ") : undefined;
}

export function sanitizePostingKeywords(keywords: string | undefined): string | undefined {
  const terms = getSearchTerms(keywords ?? "").filter((term) => !POSTING_KEYWORD_STOP_WORDS.has(term));
  return terms.length > 0 ? terms.join(" ") : undefined;
}

const INDUSTRY_TOPIC_PATTERNS: Record<string, RegExp[]> = {
  quant: [/\bquant(?:itative)?\b/, /\bhft\b/],
  "autonomous-vehicles": [
    /\bself[\s-]?driving\b/,
    /\bautonomous\s+(?:vehicle|vehicles|car|cars|driving|mapping|mobile robots?)\b/,
    /\bautonomous\b/,
    /\badas\b/,
    /\blidar\b/,
    /\bmotion planning\b/,
  ],
  robotics: [/\brobotics\b/],
  defense: [/\bdefense\b/],
  fintech: [/\bfintech\b/],
  cybersecurity: [/\bcybersecurity\b/],
  semiconductor: [/\bsemiconductor\b/],
};

export function resolveIndustrySlugFromQuery(query: string | undefined): string | undefined {
  const haystack = getSearchTerms(query ?? "").join(" ");
  if (!haystack) return undefined;

  for (const [slug, patterns] of Object.entries(INDUSTRY_TOPIC_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(haystack))) {
      return slug;
    }
  }

  return undefined;
}

export function userNamedCompanyInMessage(
  company: string | undefined,
  userMessage: string | undefined,
): boolean {
  const query = sanitizeCompanyFilter(company);
  if (!query || !userMessage?.trim()) return false;
  return companyNameMatches(userMessage, query);
}

export function formatResolvedCompanyLocation(filters: SearchPostingsInput): string | undefined {
  return formatResolvedLocationFilter(filters.location);
}
