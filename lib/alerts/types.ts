import type { AlertCadence, AlertTargetType } from "@/lib/config/alerts";
import type { AlertCountryCode, AlertSeason } from "@/lib/config/alert-filters";
import type { AlertFilterOverrideJson, AlertFilters } from "@/lib/alerts/filters";

export type { AlertFilters, AlertFilterOverrideJson };

export interface AlertSubscription {
  id: string;
  userId: string;
  targetType: AlertTargetType;
  targetId: string;
  cadence: AlertCadence;
  filterOverride: Partial<AlertFilters> | null;
  paused: boolean;
}

export interface AlertPostingCandidate {
  postingId: string;
  companyId: string;
  companySlug: string;
  industrySlug: string;
  companyName: string;
  roleName: string;
  postingUrl: string;
  season: string | null;
  location: string | null;
  countries: string[];
  hasRemote: boolean;
  firstSeenAt: string;
}

export interface AlertMatch {
  userId: string;
  posting: AlertPostingCandidate;
  channel: "instant" | "digest";
}

export type { AlertSeason, AlertCountryCode };
