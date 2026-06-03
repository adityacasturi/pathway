export const ALERT_TARGET_TYPES = ["company", "sector"] as const;
export type AlertTargetType = (typeof ALERT_TARGET_TYPES)[number];

export const ALERT_CADENCES = ["instant", "digest"] as const;
export type AlertCadence = (typeof ALERT_CADENCES)[number];

export const ALERT_CHANNELS = ["instant", "digest"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const INSTANT_ALERT_LOOKBACK_MS = 90 * 60 * 1000;
export const DIGEST_MAX_POSTINGS = 20;
export const DIGEST_CRON_UTC_HOUR = 14;

export function isAlertTargetType(value: string): value is AlertTargetType {
  return (ALERT_TARGET_TYPES as readonly string[]).includes(value);
}

export function isAlertCadence(value: string): value is AlertCadence {
  return (ALERT_CADENCES as readonly string[]).includes(value);
}
