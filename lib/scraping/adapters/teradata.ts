import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate, scraperDelay } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Teradata careers on GR8 People (GraphQL at careers.teradata.com/graphql). */
export const TERADATA_CAREERS_ORIGIN = "https://careers.teradata.com";
export const TERADATA_GRAPHQL_URL = `${TERADATA_CAREERS_ORIGIN}/graphql`;
export const TERADATA_DEFAULT_CAREERS_URL = `${TERADATA_CAREERS_ORIGIN}/jobs`;

const TERADATA_SEARCH_KEYWORD = "internship";
const TERADATA_PAGE_SIZE = 25;
const TERADATA_MAX_PAGES = 40;
const TERADATA_REQUEST_DELAY_MS = 200;

const TERADATA_SEARCH_QUERY = `query searchTeradataJobs($query: String, $start: Int, $first: Int) {
  searchJobPostings(query: $query, start: $start, first: $first) {
    results {
      nodes {
        id
        key
        title
        workplaceType
        descriptionHTML
        primaryPlace {
          name
        }
        places {
          nodes {
            name
          }
        }
        applyUrl
        postedOn
      }
      totalCount
    }
  }
}`;

export interface TeradataBoardConfig {
  graphqlUrl: string;
  careersOrigin: string;
}

export interface TeradataJobNode {
  id?: string;
  key?: string;
  title?: string;
  workplaceType?: string;
  descriptionHTML?: string;
  primaryPlace?: { name?: string } | null;
  places?: { nodes?: Array<{ name?: string }> } | null;
  applyUrl?: string;
  postedOn?: string;
}

interface TeradataSearchResponse {
  data?: {
    searchJobPostings?: {
      results?: {
        nodes?: TeradataJobNode[];
        totalCount?: number;
      };
    };
  };
  errors?: Array<{ message?: string }>;
}

export function createTeradataAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveTeradataBoard(source);
  const resolvedSource =
    source.sourceUrl === board.careersOrigin ? source : { ...source, sourceUrl: board.careersOrigin };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const nodes = await fetchAllTeradataJobs(board);
      const candidates = nodes.filter((node) => isTeradataListCandidate(node));
      return parseTeradataJobs(candidates, resolvedSource, board, nodes.length);
    },
  };
}

export function resolveTeradataBoard(source: CompanySourceConfig): TeradataBoardConfig {
  const careersOrigin = parseTeradataCareersOrigin(source.sourceUrl) ?? TERADATA_CAREERS_ORIGIN;
  const graphqlUrl = `${careersOrigin.replace(/\/$/, "")}/graphql`;

  return { graphqlUrl, careersOrigin };
}

export function parseTeradataCareersOrigin(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() === "careers.teradata.com") {
      return `${parsed.protocol}//${parsed.host}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildTeradataPostingUrl(board: TeradataBoardConfig, node: TeradataJobNode): string {
  const applyUrl = node.applyUrl?.trim() ?? "";
  if (applyUrl.endsWith("/apply")) {
    return applyUrl.slice(0, -"/apply".length);
  }
  if (isHttpUrl(applyUrl)) {
    return applyUrl;
  }

  const key = node.key?.trim();
  if (key) {
    return `${board.careersOrigin}/jobs/${key}`;
  }

  return "";
}

export function formatTeradataLocations(node: TeradataJobNode): string[] {
  const locations: string[] = [];
  const primary = node.primaryPlace?.name?.trim();
  if (primary) {
    locations.push(primary);
  }

  for (const place of node.places?.nodes ?? []) {
    const name = place.name?.trim();
    if (name && !locations.includes(name)) {
      locations.push(name);
    }
  }

  return locations;
}

export function isTeradataListCandidate(node: TeradataJobNode): boolean {
  return INTERNSHIP_LIST_TITLE_PATTERN.test(node.title?.trim() ?? "");
}

export function parseTeradataSearchResponse(payload: unknown, url: string): TeradataJobNode[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Teradata search response was not JSON for ${url}`);
  }

  const errors = (payload as TeradataSearchResponse).errors;
  if (errors?.length) {
    throw new Error(`Teradata GraphQL error for ${url}: ${errors[0]?.message ?? "unknown"}`);
  }

  const nodes = (payload as TeradataSearchResponse).data?.searchJobPostings?.results?.nodes;
  if (!Array.isArray(nodes)) {
    throw new Error(`Teradata search response was not in expected format for ${url}`);
  }

  return nodes;
}

export function parseTeradataJobs(
  nodes: TeradataJobNode[],
  source: CompanySourceConfig,
  board: TeradataBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const node of nodes) {
    const roleName = node.title?.trim() || "";
    const description = htmlToPlainText(node.descriptionHTML ?? "");
    const locations = formatTeradataLocations(node);
    const postingUrl = buildTeradataPostingUrl(board, node);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: node.workplaceType ?? null,
      locations,
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!isHttpUrl(postingUrl)) {
      rejected.push({ title: roleName, reason: "invalid_url" });
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: htmlToPlainText(node.descriptionHTML ?? ""),
        dates: atsPublishDate(safeToIsoDate(node.postedOn)),
      }),
    );
  }

  return {
    roles,
    stats: {
      fetched: fetchedTotal,
      kept: roles.length,
      rejected,
    },
  };
}

async function fetchAllTeradataJobs(board: TeradataBoardConfig): Promise<TeradataJobNode[]> {
  const nodes: TeradataJobNode[] = [];
  let total: number | null = null;

  for (let page = 0; page < TERADATA_MAX_PAGES; page++) {
    const start = page * TERADATA_PAGE_SIZE;
    const batch = await fetchTeradataSearchPage(board, start);
    if (total === null && batch.total !== null) {
      total = batch.total;
    }

    nodes.push(...batch.nodes);

    if (batch.nodes.length < TERADATA_PAGE_SIZE) {
      break;
    }
    if (total !== null && nodes.length >= total) {
      break;
    }

    await scraperDelay(TERADATA_REQUEST_DELAY_MS);
  }

  return nodes;
}

async function fetchTeradataSearchPage(
  board: TeradataBoardConfig,
  start: number,
): Promise<{ nodes: TeradataJobNode[]; total: number | null }> {
  const res = await fetchJsonWithTimeout(board.graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      operationName: "searchTeradataJobs",
      variables: {
        query: TERADATA_SEARCH_KEYWORD,
        start,
        first: TERADATA_PAGE_SIZE,
      },
      query: TERADATA_SEARCH_QUERY,
    }),
  });

  if (!res.ok) {
    throw new Error(`Teradata GraphQL returned ${res.status} for ${board.graphqlUrl}`);
  }

  const payload = (await res.json()) as unknown;
  const nodes = parseTeradataSearchResponse(payload, board.graphqlUrl);
  const total =
    payload && typeof payload === "object"
      ? ((payload as TeradataSearchResponse).data?.searchJobPostings?.results?.totalCount ?? null)
      : null;

  return { nodes, total };
}
