import type { ScrapedPostingRow } from "@/lib/discover/types";
import type { FeedPosting, FeedSeason } from "@/lib/feed/types";
import { APPLICATION_SEASONS, type ApplicationSeason } from "@/types/application";

export function feedSeasonToApplicationSeason(
  season: FeedSeason,
): ApplicationSeason | undefined {
  return (APPLICATION_SEASONS as readonly string[]).includes(season)
    ? season
    : undefined;
}

function coerceSeason(raw: string | null | undefined): ApplicationSeason | null {
  if (!raw) return null;
  return (APPLICATION_SEASONS as readonly string[]).includes(raw)
    ? (raw as ApplicationSeason)
    : null;
}

export function buildTrackApplicationFormDataFromScraped(
  posting: Pick<ScrapedPostingRow, "roleName" | "postingUrl" | "season" | "location">,
  companyName: string,
): FormData {
  const formData = new FormData();
  formData.set("company", companyName);
  formData.set("role", posting.roleName);
  formData.set("posting_url", posting.postingUrl ?? "");
  formData.set("location", posting.location ?? "");
  const season = coerceSeason(posting.season);
  if (season) formData.set("season", season);
  formData.set("date_applied", new Date().toISOString().slice(0, 10));
  return formData;
}

export function buildTrackApplicationFormData(posting: FeedPosting): FormData {
  const formData = new FormData();
  formData.set("company", posting.company);
  formData.set("role", posting.title);
  formData.set("posting_url", posting.url ?? "");
  formData.set("location", posting.locations.join(" · "));
  const season = coerceSeason(posting.season);
  if (season) formData.set("season", season);
  formData.set("date_applied", new Date().toISOString().slice(0, 10));
  return formData;
}
