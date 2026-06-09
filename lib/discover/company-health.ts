import { formatDistanceToNow } from "date-fns";
import type { DiscoverCompanyCard } from "./types.ts";

const CAREERS_MAINTENANCE_ERROR_PATTERN =
  /tenant is in maintenance|maintenance-page|\/wday\/drs\/outage|returned html instead of json|unexpected token '</i;

/** Scrapes Workday CXS directly or via a shared-board adapter on a parent tenant. */
const WORKDAY_SCRAPE_SOURCE_TYPES = new Set(["workday", "splunk", "juniper_networks", "vmware"]);

function isWorkdayScrapeFailure(
  sourceType: string | null | undefined,
  lastErrorCode: string | null | undefined,
): boolean {
  if (WORKDAY_SCRAPE_SOURCE_TYPES.has(sourceType?.trim() ?? "")) {
    return true;
  }

  const error = lastErrorCode?.trim() ?? "";
  return /workday|myworkdayjobs\.com/i.test(error);
}

export function isCareersPageMaintenanceFailure(lastErrorCode: string | null | undefined): boolean {
  const error = lastErrorCode?.trim() ?? "";
  if (!error) {
    return false;
  }

  return (
    CAREERS_MAINTENANCE_ERROR_PATTERN.test(error) ||
    /returned (520|503)/i.test(error)
  );
}

/** User-facing label when the latest scrape failed (shown on Companies). */
export function formatScrapeFailureLabel(
  sourceType: string | null | undefined,
  lastErrorCode: string | null | undefined,
): string {
  if (!isCareersPageMaintenanceFailure(lastErrorCode)) {
    return "Careers site unavailable";
  }

  if (isWorkdayScrapeFailure(sourceType, lastErrorCode)) {
    return "Workday maintenance";
  }

  return "Careers page maintenance";
}

export function getCompanyHealth(company: DiscoverCompanyCard): {
  kind: "ok" | "failed" | "pending";
  label: string;
} {
  if (!company.lastSuccessAt) {
    if (company.lastFailureAt) {
      return {
        kind: "failed",
        label: formatScrapeFailureLabel(company.sourceType, company.lastErrorCode),
      };
    }
    return { kind: "pending", label: "Coming soon" };
  }

  const label = formatDistanceToNow(new Date(company.lastSuccessAt), { addSuffix: true });
  const successAt = new Date(company.lastSuccessAt).getTime();

  if (!company.lastFailureAt) {
    return { kind: "ok", label };
  }

  const failureAt = new Date(company.lastFailureAt).getTime();
  if (failureAt > successAt) {
    return {
      kind: "failed",
      label: formatScrapeFailureLabel(company.sourceType, company.lastErrorCode),
    };
  }

  return { kind: "ok", label };
}
