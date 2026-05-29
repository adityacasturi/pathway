import type { FeedPosting } from "@/lib/feed/source";
import { APPLICATION_SEASONS, type ApplicationSeason } from "@/types/application";

function coerceSeason(raw: string | null | undefined): ApplicationSeason | null {
  if (!raw) return null;
  return (APPLICATION_SEASONS as readonly string[]).includes(raw)
    ? (raw as ApplicationSeason)
    : null;
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
