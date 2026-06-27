export const ALERT_TARGET_TYPES = ["company", "sector", "feed"] as const;
export type AlertTargetType = (typeof ALERT_TARGET_TYPES)[number];

export const ALERT_CADENCES = ["instant", "digest"] as const;
export type AlertCadence = (typeof ALERT_CADENCES)[number];

export const ALERT_CHANNELS = ["instant", "digest"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

/** Debounce before persisting alert default season/location filters from the toolbar. */
export const ALERT_DEFAULTS_SAVE_DEBOUNCE_MS = 600;

export const INSTANT_ALERT_LOOKBACK_MS = 90 * 60 * 1000;
export const DIGEST_LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const DIGEST_MAX_POSTINGS = 20;

/** User-facing copy for the daily briefing email (`digest` channel internally). */
export const DAILY_BRIEFING_COPY = {
  label: "Morning briefing",
  description: "One email each morning with every role posted in the last 24 hours.",
  hint: "One email each morning with every internship posted in the last 24 hours.",
} as const;

/** Well-known companies shown in the add-alert dialog before the user searches. */
export const ALERT_POPULAR_COMPANY_SLUGS = [
  "google",
  "jane-street",
  "amazon",
  "microsoft",
  "nvidia",
  "stripe",
  "openai",
] as const;

/** Featured industry packs shown first in the add-alert dialog. */
export const ALERT_FEATURED_INDUSTRY_SLUGS = [
  "faang",
  "quant",
  "ai-stack",
  "fintech",
  "data-platforms",
  "payments",
  "hot-ai-startups",
  "quant-tier-1",
] as const;

export function isAlertTargetType(value: string): value is AlertTargetType {
  return (ALERT_TARGET_TYPES as readonly string[]).includes(value);
}

export function isAlertCadence(value: string): value is AlertCadence {
  return (ALERT_CADENCES as readonly string[]).includes(value);
}
