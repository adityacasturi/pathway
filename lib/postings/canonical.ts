export interface CanonicalPosting {
  id: string;
  companyName: string;
  roleName: string;
  postingUrl: string;
  datePosted: string | null;
  firstSeenAt: string | null;
  season: string;
  seasonYear: number | null;
  locations: string[];
  status: "open" | "stale" | "closed" | "unknown";
}

export function normalizeCanonicalPosting(row: {
  id: string;
  company_name: string;
  role_name: string;
  posting_url: string;
  date_posted: string | null;
  first_seen_at: string | null;
  season: string;
  season_year: number | null;
  locations: string[] | null;
  status: "open" | "stale" | "closed" | "unknown";
}): CanonicalPosting {
  return {
    id: row.id,
    companyName: row.company_name,
    roleName: row.role_name,
    postingUrl: row.posting_url,
    datePosted: row.date_posted,
    firstSeenAt: row.first_seen_at,
    season: row.season,
    seasonYear: row.season_year,
    locations: row.locations ?? [],
    status: row.status,
  };
}
