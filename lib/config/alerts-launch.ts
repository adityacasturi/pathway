/** User-facing error when alerts are preview-only. */
export const ALERTS_PREVIEW_LOCKED_MESSAGE =
  "New-role email alerts are coming soon.";

/**
 * When true, users can change alert settings and crons may send email.
 * Set `ALERTS_LAUNCHED=true` in the deployment environment to go live.
 */
export function isAlertsLaunched(): boolean {
  const value = process.env.ALERTS_LAUNCHED?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}
