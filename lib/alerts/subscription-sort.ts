import type { AlertSubscriptionView } from "@/components/alerts/types";

/** Industries first, then companies; alphabetical within each group. */
export function sortAlertSubscriptions(
  subscriptions: AlertSubscriptionView[],
): AlertSubscriptionView[] {
  const typeOrder = { sector: 0, company: 1 } as const;

  return [...subscriptions].sort((a, b) => {
    if (a.type !== b.type) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}
