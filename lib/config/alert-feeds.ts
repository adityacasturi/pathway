import type { AlertCadence } from "@/lib/config/alerts";

export const ALERT_FEED_SLUGS = ["morning-briefing", "nightly-briefing"] as const;
export type AlertFeedSlug = (typeof ALERT_FEED_SLUGS)[number];

export interface AlertFeedDefinition {
  slug: AlertFeedSlug;
  label: string;
  description: string;
  cadence: AlertCadence;
  frequencyLabel: string;
}

export const ALERT_FEED_DEFINITIONS: AlertFeedDefinition[] = [
  {
    slug: "morning-briefing",
    label: "Morning briefing",
    description: "One email each morning with new roles posted in the last 24 hours.",
    cadence: "digest",
    frequencyLabel: "Every morning",
  },
  {
    slug: "nightly-briefing",
    label: "Nightly briefing",
    description: "One email each night with new roles posted in the last 24 hours.",
    cadence: "digest",
    frequencyLabel: "Every night",
  },
];

export const MORNING_BRIEFING_FEED_SLUG = "morning-briefing" as const;
export const NIGHTLY_BRIEFING_FEED_SLUG = "nightly-briefing" as const;

const feedBySlug = new Map(ALERT_FEED_DEFINITIONS.map((feed) => [feed.slug, feed]));

export function getAlertFeedDefinition(slug: string): AlertFeedDefinition | undefined {
  return feedBySlug.get(slug as AlertFeedSlug);
}

export function isAlertFeedSlug(value: string): value is AlertFeedSlug {
  return (ALERT_FEED_SLUGS as readonly string[]).includes(value);
}
