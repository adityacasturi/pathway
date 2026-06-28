import {
  hasEngineeringSignal,
  hasInternshipSignal,
  INTERNSHIP_TITLE_PATTERN,
  isInternshipEmploymentMetadata,
  isNonTargetRoleTitle,
  matchesInternshipTitle,
} from "../feed/roles.ts";
import type { StructuredPlaceInput } from "../geo/types.ts";
import { htmlToPlainText } from "./plain-text.ts";

/**
 * Centralized role relevance classification.
 *
 * Every adapter funnels candidates through {@link classifyScrapeRole} (via
 * `classifyForSource`). The decision is explainable: `reason` is the primary
 * machine-readable outcome and `signals` lists every positive and negative
 * cue that fired, so logs can answer "why was this role kept/dropped?".
 *
 * Location is intentionally NOT part of relevance: a real internship with an
 * unparseable location is kept and stored with honest unknowns.
 */

/** Include full-time new-grad roles? Off until the product intentionally supports them. */
export const INCLUDE_NEW_GRAD_ROLES = false;

export type ScrapeRoleType = "internship" | "co_op" | "new_grad";

export interface ScrapeRoleCandidate {
  title: string;
  description?: string | null;
  employmentType?: string | null;
  commitment?: string | null;
  team?: string | null;
  departments?: string[];
  locations?: string[];
  structuredLocations?: StructuredPlaceInput[];
  companyName?: string | null;
  companySlug?: string | null;
}

export interface RoleClassification {
  include: boolean;
  reason: RoleClassificationReason;
  /** internship / co_op / new_grad when a student-opportunity signal matched. */
  roleType: ScrapeRoleType | null;
  /** Every positive and negative cue that fired, for explainability. */
  signals: string[];
  /** Raw location inputs carried through to role building (resolved exactly once there). */
  locations: string[];
  structuredLocations: StructuredPlaceInput[];
}

export type RoleClassificationReason =
  | "included"
  | "missing_title"
  | "title_false_positive"
  | "no_student_signal"
  | "senior_level_role"
  | "new_grad_excluded"
  | "non_engineering_role";

/** "Internal Audit", "International Sales", "Internet Services" are not internships. */
const TITLE_FALSE_POSITIVE_PATTERN = /\binternal\b|\binternational\b|\binternet\b/i;

/** Strong student-opportunity cues in titles. */
const STUDENT_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bcooperative education\b|\bsummer\s+(?:analyst|associate)\b|\bindustrial placement\b|\bplacement year\b|\bworking student\b|\bstudent\s+(?:researcher|engineer|developer|assistant|worker)\b|\bfellowship\b|\bgraduate intern\b/i;

const CO_OP_PATTERN = /\bco-?op\b|\bcooperative education\b/i;

/** Full-time campus-hire titles: real roles, but not internships. */
const NEW_GRAD_TITLE_PATTERN =
  /\bnew\s*grad(?:uate)?\b|\bentry[-\s]?level\b|\bgraduate (?:program|scheme|engineer|analyst|hire)\b|\bcampus hire\b|\b(?:software\s+)?engineer\s+grad\b/i;

/** Department/team names that indicate student programs. */
const STUDENT_CONTEXT_PATTERN =
  /\buniversity\b|\bintern\b|\bearly talent\b|\bemerging talent\b|\bcampus\b|\bstudent\b/i;

/**
 * Seniority cues that veto weak (non-title) student signals. "Senior Hardware
 * Engineer" whose description mentions the company's intern program must not
 * be kept.
 */
const SENIORITY_TITLE_PATTERN =
  /\bsenior\b|\bsr\.?\b|\bstaff\b|\bprincipal\b|\bdistinguished\b|\blead\b|\bmanager\b|\bdirector\b|\bhead of\b|\bchief\b|\bvp\b|\bvice president\b|\bexperienced\b|\barchitect\b/i;

/** "Engineer II/III/IV", "L5", "Level 3" — leveled full-time tracks. */
const LEVELED_TITLE_PATTERN =
  /\b(?:ii|iii|iv|v|vi)\b\s*$|\b(?:ii|iii|iv|v|vi)\b\s*[,(-]|\b(?:level|lvl)\s*[2-9]\b|\bL[4-9]\b/i;

const PERMANENT_METADATA_PATTERN =
  /\bpermanent\b|\bfull[-\s]?time\b|\bfulltime\b|\bregular\b|\bsalaried\b/i;

interface SignalScan {
  /** Strongest student signal location: title beats metadata beats description. */
  strength: "title" | "metadata" | "context" | "description" | null;
  roleType: ScrapeRoleType | null;
  signals: string[];
}

function scanStudentSignals(
  candidate: ScrapeRoleCandidate,
  title: string,
  descriptionPlain: string,
): SignalScan {
  const signals: string[] = [];
  let strength: SignalScan["strength"] = null;
  let roleType: ScrapeRoleType | null = null;

  const record = (
    signal: string,
    s: NonNullable<SignalScan["strength"]>,
    type: ScrapeRoleType,
  ) => {
    signals.push(signal);
    const order = { title: 3, metadata: 2, context: 1, description: 0 };
    if (strength === null || order[s] > order[strength]) {
      strength = s;
      roleType = type;
    }
  };

  if (matchesInternshipTitle(title) || STUDENT_TITLE_PATTERN.test(title)) {
    record(
      CO_OP_PATTERN.test(title) ? "title:co_op" : "title:student_opportunity",
      "title",
      CO_OP_PATTERN.test(title) ? "co_op" : "internship",
    );
  }

  if (isInternshipEmploymentMetadata(candidate.employmentType)) {
    record(
      "metadata:employment_type",
      "metadata",
      CO_OP_PATTERN.test(candidate.employmentType ?? "") ? "co_op" : "internship",
    );
  }
  if (isInternshipEmploymentMetadata(candidate.commitment)) {
    record(
      "metadata:commitment",
      "metadata",
      CO_OP_PATTERN.test(candidate.commitment ?? "") ? "co_op" : "internship",
    );
  }

  if (candidate.team && STUDENT_CONTEXT_PATTERN.test(candidate.team)) {
    record(`context:team`, "context", "internship");
  }
  for (const department of candidate.departments ?? []) {
    if (STUDENT_CONTEXT_PATTERN.test(department)) {
      record(`context:department:${department.trim()}`, "context", "internship");
      break;
    }
  }

  if (descriptionPlain && hasInternshipSignal("", descriptionPlain)) {
    record("description:internship_program", "description", "internship");
  }

  return { strength, roleType, signals };
}

export function classifyScrapeRole(candidate: ScrapeRoleCandidate): RoleClassification {
  const title = candidate.title.trim();
  const locations = candidate.locations ?? [];
  const structuredLocations = candidate.structuredLocations ?? [];

  const rejected = (
    reason: RoleClassificationReason,
    signals: string[],
    roleType: ScrapeRoleType | null = null,
  ): RoleClassification => ({
    include: false,
    reason,
    roleType,
    signals,
    locations,
    structuredLocations,
  });

  if (!title) {
    return rejected("missing_title", []);
  }

  // "Internal Tools Engineer" / "International Tax Analyst" without a real
  // student token is a false positive of substring-style matching.
  if (
    TITLE_FALSE_POSITIVE_PATTERN.test(title) &&
    !INTERNSHIP_TITLE_PATTERN.test(title) &&
    !STUDENT_TITLE_PATTERN.test(title)
  ) {
    return rejected("title_false_positive", ["negative:title_false_positive"]);
  }

  const descriptionPlain = normalizeDescription(candidate.description);
  const scan = scanStudentSignals(candidate, title, descriptionPlain);
  const signals = [...scan.signals];

  // New-grad titles are full-time campus hires, not internships, unless the
  // title itself also carries an intern token ("New Grad & Intern Openings").
  if (NEW_GRAD_TITLE_PATTERN.test(title) && scan.strength !== "title") {
    signals.push("title:new_grad");
    if (!INCLUDE_NEW_GRAD_ROLES) {
      return rejected("new_grad_excluded", signals, "new_grad");
    }
    return finishInclude(candidate, title, descriptionPlain, "new_grad", signals, locations, structuredLocations);
  }

  if (scan.strength === null) {
    return rejected("no_student_signal", signals);
  }

  // GH/ATS boards sometimes mark non-engineering roles (e.g. Production
  // Technician - SkillBridge) as employmentType=Intern; do not inherit
  // engineering scope from employer boilerplate when the title itself is not
  // engineering.
  if (scan.strength === "metadata" && !hasEngineeringSignal(title, "")) {
    signals.push("negative:metadata_only_non_engineering_title");
    return rejected("non_engineering_role", signals, scan.roleType);
  }

  // Negative signals veto anything weaker than an explicit student title.
  if (scan.strength !== "title") {
    if (SENIORITY_TITLE_PATTERN.test(title)) {
      signals.push("negative:seniority_title");
      return rejected("senior_level_role", signals, scan.roleType);
    }
    if (LEVELED_TITLE_PATTERN.test(title)) {
      signals.push("negative:leveled_title");
      return rejected("senior_level_role", signals, scan.roleType);
    }
    if (
      PERMANENT_METADATA_PATTERN.test(candidate.employmentType ?? "") &&
      !isInternshipEmploymentMetadata(candidate.employmentType)
    ) {
      signals.push("negative:permanent_employment_type");
      return rejected("senior_level_role", signals, scan.roleType);
    }
  }

  return finishInclude(
    candidate,
    title,
    descriptionPlain,
    scan.roleType ?? "internship",
    signals,
    locations,
    structuredLocations,
  );
}

function finishInclude(
  candidate: ScrapeRoleCandidate,
  title: string,
  descriptionPlain: string,
  roleType: ScrapeRoleType,
  signals: string[],
  locations: string[],
  structuredLocations: StructuredPlaceInput[],
): RoleClassification {
  if (isNonTargetRoleTitle(title)) {
    signals.push("negative:non_target_title");
    return {
      include: false,
      reason: "non_engineering_role",
      roleType,
      signals,
      locations,
      structuredLocations,
    };
  }

  const departmentText = (candidate.departments ?? [])
    .map((department) => department.trim())
    .filter(Boolean)
    .join("\n");
  const teamText = candidate.team?.trim() ?? "";
  const orgContext = [teamText, departmentText].filter(Boolean).join("\n");

  // Explicit intern/co-op titles must not inherit engineering scope from generic
  // company boilerplate in the posting body (e.g. "machine learning" in About Us).
  const studentFromExplicitTitle = signals.some(
    (signal) => signal === "title:student_opportunity" || signal === "title:co_op",
  );
  const titleOrOrgEngineering =
    hasEngineeringSignal(title, orgContext) ||
    (orgContext.length > 0 && hasEngineeringSignal("", orgContext));
  const descriptionOnlyEngineering =
    !studentFromExplicitTitle && hasEngineeringSignal("", descriptionPlain);
  const engineering = titleOrOrgEngineering || descriptionOnlyEngineering;

  if (!engineering) {
    signals.push("negative:missing_engineering_signal");
    return {
      include: false,
      reason: "non_engineering_role",
      roleType,
      signals,
      locations,
      structuredLocations,
    };
  }

  signals.push("engineering_scope");
  return {
    include: true,
    reason: "included",
    roleType,
    signals,
    locations,
    structuredLocations,
  };
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
