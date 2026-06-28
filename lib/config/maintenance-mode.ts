/** Toggle site-wide maintenance via `MAINTENANCE_MODE=true` (Vercel env or `.env.local`). */
export const MAINTENANCE_PATH = "/maintenance";

export function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === "true";
}
