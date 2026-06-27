import type { AlertCadence, AlertTargetType } from "../config/alerts.ts";
import type { AlertCountryCode, AlertSeason } from "../config/alert-filters.ts";
import type { AlertFilterOverrideJson, AlertFilters } from "./filters.ts";

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
  postedAt: string;
}

export interface AlertMatch {
  userId: string;
  posting: AlertPostingCandidate;
  channel: "instant";
}

export type { AlertSeason, AlertCountryCode };
