export type AlertSubscriptionType = "company" | "sector";

export function alertSubscriptionTypeLabel(type: AlertSubscriptionType): string {
  if (type === "company") return "Company";
  return "Industry";
}
