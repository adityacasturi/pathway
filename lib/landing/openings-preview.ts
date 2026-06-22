import type { FeedPosting } from "@/lib/feed/types";

export const LANDING_OPENINGS_DAYS = 7;
/** Generous cap so the public feed shows the full recent window, not a teaser. */
export const LANDING_OPENINGS_LIMIT = 200;

interface PreviewOptions {
  nowUnix?: number;
  days?: number;
  limit?: number;
}

export function selectLandingOpeningPreview(
  postings: readonly FeedPosting[],
  {
    nowUnix = Math.floor(Date.now() / 1000),
    days = LANDING_OPENINGS_DAYS,
    limit = LANDING_OPENINGS_LIMIT,
  }: PreviewOptions = {},
): FeedPosting[] {
  const earliestUnix = nowUnix - days * 86_400;

  return postings
    .filter((posting) => posting.datePosted >= earliestUnix && posting.datePosted <= nowUnix)
    .toSorted((a, b) => b.datePosted - a.datePosted)
    .slice(0, limit);
}
