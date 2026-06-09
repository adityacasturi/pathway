import { getCompanyHealth } from "@/lib/discover/company-health";

export { getCompanyHealth };

export function formatOpeningCount(count: number): string {
  if (count <= 0) return "No open roles";
  return count === 1 ? "1 opening" : `${count} openings`;
}
