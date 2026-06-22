import type { AlertSubscriptionView } from "@/components/alerts/types";

/** Bundles first, then companies; alphabetical within each group. */
export function sortAlertSubscriptions(
  subscriptions: AlertSubscriptionView[],
): AlertSubscriptionView[] {
  return [...subscriptions].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "sector" ? -1 : 1;
    }
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}
