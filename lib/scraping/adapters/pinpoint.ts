import { classifyForSource } from "../adapter-parse.ts";
import { formatScrapedLocation } from "../location.ts";
import { htmlToPlainText } from "../plain-text.ts";
import { atsPublishWithModified } from "../posted-date.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

export interface PinpointBoardConfig {
  careersOrigin: string;
  postingsUrl: string;
}

export interface PinpointPosting {
  id?: string | number;
  title?: string;
  url?: string;
  path?: string;
  description?: string;
  key_responsibilities?: string;
  skills_knowledge_expertise?: string;
  benefits?: string;
  employment_type?: string;
  employment_type_text?: string;
  workplace_type?: string;
  workplace_type_text?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  location?: {
    city?: string;
    name?: string;
    province?: string;
    country?: string;
  } | null;
  job?: {
    department?: { name?: string } | null;
    division?: { name?: string } | null;
    structure_custom_group_one?: { name?: string; title?: string } | null;
  } | null;
}

interface PinpointPostingsResponse {
  data?: PinpointPosting[];
}

export function createPinpointAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolvePinpointBoard(source);
  const resolvedSource =
    source.sourceUrl === board.postingsUrl && source.boardToken === board.careersOrigin
      ? source
      : { ...source, sourceUrl: board.postingsUrl, boardToken: board.careersOrigin };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const postings = await fetchPinpointPostings(board.postingsUrl);
      return parsePinpointJobs(postings, resolvedSource, board.careersOrigin, postings.length);
    },
  };
}

export function resolvePinpointBoard(source: CompanySourceConfig): PinpointBoardConfig {
  const sourceUrl = source.sourceUrl?.trim() || source.boardToken?.trim() || "";
  if (!isHttpUrl(sourceUrl)) {
    throw new Error(`Pinpoint source URL must be an http(s) URL for ${source.companySlug}`);
  }

  const parsed = new URL(sourceUrl);
  const careersOrigin = parsed.origin;
  const postingsUrl = pinpointJsonUrl(parsed);
  return { careersOrigin, postingsUrl };
}

export function parsePinpointJobs(
  postings: PinpointPosting[],
  source: CompanySourceConfig,
  careersOrigin: string,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const roleName = posting.title?.trim() || "";
    const postingUrl = buildPinpointPostingUrl(posting, careersOrigin);
    const description = formatPinpointDescription(posting);
    const departments = pinpointDepartments(posting);
    const location = formatPinpointLocation(posting, source);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: posting.employment_type_text ?? posting.employment_type ?? null,
      commitment: posting.workplace_type_text ?? posting.workplace_type ?? null,
      departments,
      locations: location ? [location] : [],
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!postingUrl || !isHttpUrl(postingUrl)) {
      rejected.push({ title: roleName, reason: "invalid_url" });
      continue;
    }

    const publishedAt = safeToIsoDate(posting.published_at ?? posting.created_at);
    const updatedAt = safeToIsoDate(posting.updated_at);

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description,
        dates: atsPublishWithModified(publishedAt, updatedAt),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parsePinpointPostingsPayload(payload: unknown, url: string): PinpointPosting[] {
  if (Array.isArray(payload)) {
    return payload.filter(isPinpointPosting);
  }

  if (payload && typeof payload === "object") {
    const data = (payload as PinpointPostingsResponse).data;
    if (Array.isArray(data)) {
      return data.filter(isPinpointPosting);
    }
  }

  throw new Error(`Pinpoint postings response was not in expected format for ${url}`);
}

function pinpointJsonUrl(parsed: URL): string {
  if (parsed.pathname.endsWith(".json")) {
    return parsed.toString();
  }

  const pathname = parsed.pathname.replace(/\/$/, "");
  if (!pathname || pathname === "/") {
    parsed.pathname = "/jobs.json";
  } else {
    parsed.pathname = `${pathname}.json`;
  }
  parsed.search = "";
  return parsed.toString();
}

function buildPinpointPostingUrl(posting: PinpointPosting, careersOrigin: string): string | null {
  const direct = posting.url?.trim();
  if (direct && isHttpUrl(direct)) {
    return direct;
  }

  const path = posting.path?.trim();
  if (path?.startsWith("/")) {
    return `${careersOrigin}${path}`;
  }

  if (posting.id != null) {
    return `${careersOrigin}/postings/${encodeURIComponent(String(posting.id))}`;
  }

  return null;
}

function formatPinpointDescription(posting: PinpointPosting): string {
  return [
    posting.description,
    posting.key_responsibilities,
    posting.skills_knowledge_expertise,
    posting.benefits,
  ]
    .map((part) => htmlToPlainText(part ?? ""))
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

function formatPinpointLocation(
  posting: PinpointPosting,
  source: Pick<CompanySourceConfig, "companyName" | "companySlug">,
): string | null {
  const location = posting.location;
  if (!location) {
    return null;
  }

  const composed = [location.city, location.province, location.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

  return formatScrapedLocation(
    [location.name?.trim() || composed].filter((part): part is string => Boolean(part?.trim())),
    source,
  );
}

function pinpointDepartments(posting: PinpointPosting): string[] {
  return [
    posting.job?.department?.name,
    posting.job?.division?.name,
    posting.job?.structure_custom_group_one?.name,
  ].filter((value): value is string => Boolean(value?.trim()));
}

async function fetchPinpointPostings(postingsUrl: string): Promise<PinpointPosting[]> {
  const response = await fetchJsonWithTimeout(postingsUrl);
  if (!response.ok) {
    throw new Error(`Pinpoint postings returned ${response.status} for ${postingsUrl}`);
  }
  return parsePinpointPostingsPayload(await response.json(), postingsUrl);
}

function isPinpointPosting(value: unknown): value is PinpointPosting {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as PinpointPosting).title === "string",
  );
}
