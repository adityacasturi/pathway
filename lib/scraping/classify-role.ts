import {
  hasEngineeringSignal,
  hasInternshipSignal,
  INTERNSHIP_TITLE_PATTERN,
  isFullTimeGradRole,
  isInternshipEmploymentMetadata,
  isNonTargetRoleTitle,
  matchesInternshipTitle,
} from "../feed/roles.ts";
import { trimToUsLocations } from "../feed/us-locations.ts";
import { formatScrapedLocation, normalizeScrapedLocations } from "./location.ts";
import { htmlToPlainText } from "./plain-text.ts";

export interface ScrapeRoleCandidate {
  title: string;
  description?: string | null;
  employmentType?: string | null;
  commitment?: string | null;
  team?: string | null;
  departments?: string[];
  locations?: string[];
  companyName?: string | null;
  companySlug?: string | null;
}

export interface RoleClassification {
  include: boolean;
  reason: RoleClassificationReason;
  signals: string[];
  /** Normalized US-only segments when {@link include} is true. */
  locations?: string[];
}

export type RoleClassificationReason =
  | "included"
  | "missing_title"
  | "no_internship_signal"
  | "full_time_grad_role"
  | "title_false_positive"
  | "non_engineering_role"
  | "missing_location"
  | "non_us_location";

/** Lenient internship cues — prefer keeping borderline roles over dropping real interns. */
const LENIENT_INTERNSHIP_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bsummer\s+analyst\b|\bseasonal\/off[- ]?cycle\b/i;

const LENIENT_INTERNSHIP_CONTEXT_PATTERN =
  /\buniversity\b|\bintern\b|\bearly talent\b|\bemerging talent\b|\bstudent\s+(?:researcher|engineer)\b|\bphd\s+intern\b/i;

export function classifyScrapeRole(candidate: ScrapeRoleCandidate): RoleClassification {
  const signals: string[] = [];
  const title = candidate.title.trim();

  if (!title) {
    return { include: false, reason: "missing_title", signals };
  }

  const descriptionPlain = normalizeDescription(candidate.description);
  const context = buildClassificationContext(descriptionPlain, candidate);

  if (/\binternal\b|\binternational\b|\binternet\b/i.test(title) && !INTERNSHIP_TITLE_PATTERN.test(title)) {
    signals.push("title_false_positive");
    return { include: false, reason: "title_false_positive", signals };
  }

  if (isFullTimeGradRole(title, buildClassificationContext(descriptionPlain, candidate))) {
    signals.push("full_time_grad_role");
    return { include: false, reason: "full_time_grad_role", signals };
  }

  if (!hasLenientInternshipSignal(candidate, title, descriptionPlain, signals)) {
    return { include: false, reason: "no_internship_signal", signals };
  }

  if (isNonTargetRoleTitle(title)) {
    signals.push("non_target_title");
    return { include: false, reason: "non_engineering_role", signals };
  }

  const engineering =
    hasEngineeringSignal(title, context) ||
    (candidate.team ? hasEngineeringSignal(candidate.team, context) : false);

  if (!engineering) {
    signals.push("missing_engineering_signal");
    return { include: false, reason: "non_engineering_role", signals };
  }

  const locationContext = {
    companyName: candidate.companyName,
    companySlug: candidate.companySlug,
  };
  const locations = normalizeScrapedLocations(candidate.locations ?? [], locationContext);
  if (locations.length === 0) {
    signals.push("missing_location");
    return { include: false, reason: "missing_location", signals };
  }

  const usLocations = trimToUsLocations(locations);
  if (usLocations.length === 0) {
    signals.push("non_us_location");
    return { include: false, reason: "non_us_location", signals };
  }

  signals.push("has_location", "us_location");
  return { include: true, reason: "included", signals, locations: usLocations };
}

/** Storage-ready location string from a successful classification. */
export function formatClassifiedScrapeLocation(
  classification: RoleClassification,
  context: { companyName?: string | null; companySlug?: string | null } = {},
): string | null {
  if (!classification.include || !classification.locations?.length) {
    return null;
  }
  return formatScrapedLocation(classification.locations, context);
}

function hasLenientInternshipSignal(
  candidate: ScrapeRoleCandidate,
  title: string,
  descriptionPlain: string,
  signals: string[],
): boolean {
  if (matchesInternshipTitle(title) || LENIENT_INTERNSHIP_TITLE_PATTERN.test(title)) {
    signals.push("internship_title");
    return true;
  }

  if (isInternshipEmploymentMetadata(candidate.employmentType)) {
    signals.push("internship_employment_type");
    return true;
  }
  if (isInternshipEmploymentMetadata(candidate.commitment)) {
    signals.push("internship_commitment");
    return true;
  }

  if (candidate.team && LENIENT_INTERNSHIP_CONTEXT_PATTERN.test(candidate.team)) {
    signals.push("internship_team");
    return true;
  }

  for (const department of candidate.departments ?? []) {
    if (LENIENT_INTERNSHIP_CONTEXT_PATTERN.test(department)) {
      signals.push(`internship_department:${department}`);
      return true;
    }
  }

  if (descriptionPlain && hasInternshipSignal("", descriptionPlain)) {
    signals.push("internship_description");
    return true;
  }

  return false;
}

function normalizeDescription(description: string | null | undefined): string {
  if (!description?.trim()) {
    return "";
  }
  const trimmed = description.trim();
  if (trimmed.includes("<") && trimmed.includes(">")) {
    return htmlToPlainText(trimmed);
  }
  return trimmed.replace(/\s+/g, " ").trim();
}

function buildClassificationContext(descriptionPlain: string, candidate: ScrapeRoleCandidate): string {
  const parts = [descriptionPlain];
  if (candidate.team?.trim()) {
    parts.push(candidate.team.trim());
  }
  for (const department of candidate.departments ?? []) {
    if (department.trim()) {
      parts.push(department.trim());
    }
  }
  return parts.filter(Boolean).join("\n");
}
