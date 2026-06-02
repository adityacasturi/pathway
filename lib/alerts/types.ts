import type { AlertCadence, AlertTargetType } from "@/lib/config/alerts";

export interface AlertSubscription {
  id: string;
  userId: string;
  targetType: AlertTargetType;
  targetId: string;
  cadence: AlertCadence;
}

export interface AlertPostingCandidate {
  postingId: string;
  companyId: string;
  companySlug: string;
  industrySlug: string;
  companyName: string;
  roleName: string;
  postingUrl: string;
  season: string;
  location: string | null;
  firstSeenAt: string;
}

export interface AlertMatch {
  userId: string;
  posting: AlertPostingCandidate;
  channel: "instant" | "digest";
}
