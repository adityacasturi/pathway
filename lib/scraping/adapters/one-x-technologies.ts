import { atsPublishDate, unknownScrapedDates } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { formatScrapedLocation } from "../location.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

export const ONE_X_TECHNOLOGIES_CAREERS_URL = "https://www.1x.tech/careers";
export const ONE_X_RECRUITEE_OFFERS_API = "https://1x.recruitee.com/api/offers/";
export const ONE_X_RECRUITEE_BOARD_TOKEN = "1x";

export interface OneXRecruiteeLocation {
  city?: string;
  state?: string;
  country?: string;
  name?: string;
}

export interface OneXRecruiteeOffer {
  id?: number;
  slug?: string;
  title?: string;
  description?: string;
  requirements?: string;
  careers_url?: string;
  careers_apply_url?: string;
  published_at?: string;
  updated_at?: string;
  status?: string;
  employment_type_code?: string;
  remote?: boolean;
  hybrid?: boolean;
  on_site?: boolean;
  locations?: OneXRecruiteeLocation[];
  city?: string;
  state_name?: string;
  country?: string;
  department?: string;
}

interface OneXRecruiteeOffersResponse {
  offers?: OneXRecruiteeOffer[];
}

export function createOneXTechnologiesAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const boardToken = source.boardToken?.trim() || ONE_X_RECRUITEE_BOARD_TOKEN;
  const offersApiUrl =
    source.sourceUrl?.trim() ||
    `https://${boardToken}.recruitee.com/api/offers/`;
  const resolvedSource =
    source.boardToken === boardToken && source.sourceUrl === offersApiUrl
      ? source
      : { ...source, boardToken, sourceUrl: offersApiUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const offers = await fetchOneXRecruiteeOffers(offersApiUrl);
      const published = offers.filter((offer) => offer.status === "published");
      return parseOneXRecruiteeJobs(published, resolvedSource, offers.length);
    },
  };
}

export async function fetchOneXRecruiteeOffers(offersApiUrl: string): Promise<OneXRecruiteeOffer[]> {
  const res = await fetchJsonWithTimeout(offersApiUrl);
  if (!res.ok) {
    throw new Error(`Recruitee offers API returned ${res.status} for ${offersApiUrl}`);
  }
  const payload = (await res.json()) as OneXRecruiteeOffersResponse;
  if (!payload || !Array.isArray(payload.offers)) {
    throw new Error(`Recruitee offers response was not in expected format for ${offersApiUrl}`);
  }
  return payload.offers;
}

export function formatOneXRecruiteeLocation(offer: OneXRecruiteeOffer): string | null {
  const parts: string[] = [];

  for (const location of offer.locations ?? []) {
    const segment = [location.city, location.state, location.country]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ");
    if (segment) {
      parts.push(segment);
    }
  }

  const fallback = [offer.city, offer.state_name, offer.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  if (fallback) {
    parts.push(fallback);
  }

  return formatScrapedLocation(parts);
}

export function parseOneXRecruiteeJobs(
  offers: OneXRecruiteeOffer[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const offer of offers) {
    const roleName = offer.title?.trim() || "";
    const postingUrl = offer.careers_url?.trim() || "";
    const description = htmlToPlainText(
      [offer.description, offer.requirements].filter(Boolean).join("\n\n"),
    ).trim();
    const location = formatOneXRecruiteeLocation(offer);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: offer.employment_type_code ?? null,
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

    const publishedAt = safeToIsoDate(offer.published_at ?? offer.updated_at);

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: htmlToPlainText(
      [offer.description, offer.requirements].filter(Boolean).join("\n\n"),
    ).trim(),
        dates: publishedAt ? atsPublishDate(publishedAt) : unknownScrapedDates(),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

