/** Only scan the start of context so full descriptions do not create false positives. */
export const INTERNSHIP_CONTEXT_HEAD_CHARS = 200;
export const ENGINEERING_CONTEXT_HEAD_CHARS = 500;

export const INTERNSHIP_TITLE_PATTERN = /\bintern(?:ship|ships)?\b|\bco-?op\b/i;

export const INTERNSHIP_CONTEXT_PATTERN =
  /\b(?:summer|fall|winter|spring)?\s*(?:internship|co-?op)\b|\bindustrial placement year\b/i;

export const INTERNSHIP_EMPLOYMENT_METADATA_PATTERN =
  /\bintern(?:ship)?\b|\bco-?op\b|\bcooperative education\b/i;

/** Full-time campus hire titles — not internships even when listed near university programs. */
export const FULL_TIME_GRAD_ROLE_PATTERN =
  /\bnew\s*grad(?:uate)?\b|\bentry[-\s]?level\b/i;

const TITLE_FALSE_POSITIVE_PATTERN = /\binternal\b|\binternational\b|\binternet\b/i;

export const TARGET_ROLE_PATTERNS = [
  /\bsoftware\b/i,
  /\bswe\b/i,
  /\bfront[-\s]?end\b/i,
  /\bback[-\s]?end\b/i,
  /\bfull[-\s]?stack\b/i,
  /\bdeveloper\b/i,
  /\bengineering\b/i,
  /\bengineer\b/i,
  /\bquant(?:itative)?\b/i,
  /\btrader\b/i,
  /\btrading\b/i,
  /\bcompilers?\b/i,
  /\bresearch(?:er)?\b/i,
  /\bmachine learning\b/i,
  /\bml\b/i,
  /\bai\b/i,
  /\bdata (?:science|scientist|engineering|engineer)\b/i,
  /\binfrastructure\b/i,
  /\bplatform\b/i,
  /\bsecurity\b/i,
  /\bhardware\b/i,
  /\bfirmware\b/i,
  /\bembedded\b/i,
  /\brobotics\b/i,
  /\bforward deployed\b/i,
];

export const NON_TARGET_ROLE_PATTERNS = [
  /\bfield sales\b/i,
  /\bsales\b/i,
  /\baccount\b/i,
  /\bbusiness\b/i,
  /\bmarketing\b/i,
  /\bcommunications?\b/i,
  /\bcontent\b/i,
  /\blegal\b/i,
  /\bpolicy\b/i,
  /\bfinance\b/i,
  /\baccounting\b/i,
  /\bpeople\b/i,
  /\bhr\b/i,
  /\brecruit(?:er|ing)?\b/i,
  /\btalent\b/i,
  /\bcustomer\b/i,
  /\bsupport\b/i,
  /\bsuccess\b/i,
  /\boperations?\b/i,
  /\bstrategist\b/i,
  /\bstrategy\b/i,
  /\bprogram manager\b/i,
  /\bproject manager\b/i,
  /\bproduct manager\b/i,
  /\bproduct management\b/i,
  /\bproduct design\b/i,
  /\bdesigner\b/i,
  /\bdesign\b/i,
  /\bcopywriter\b/i,
];

export function isInternshipEmploymentMetadata(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  return INTERNSHIP_EMPLOYMENT_METADATA_PATTERN.test(value.trim());
}

export function isPermanentEmploymentMetadata(value: string | null | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }
  const normalized = value.trim();
  if (isInternshipEmploymentMetadata(normalized)) {
    return false;
  }
  return /\bpermanent\b|\bfull[-\s]?time\b|\bfulltime\b|\bcontractor\b|\bsalaried\s+employee\b/i.test(
    normalized,
  );
}

export function matchesInternshipTitle(title: string): boolean {
  const titleText = title.trim();
  if (!titleText) {
    return false;
  }
  if (TITLE_FALSE_POSITIVE_PATTERN.test(titleText) && !INTERNSHIP_TITLE_PATTERN.test(titleText)) {
    return false;
  }
  return INTERNSHIP_TITLE_PATTERN.test(titleText);
}

export function isFullTimeGradRole(title: string, context = ""): boolean {
  const titleText = title.trim();
  if (!titleText) {
    return false;
  }
  if (matchesInternshipTitle(titleText)) {
    return false;
  }
  if (FULL_TIME_GRAD_ROLE_PATTERN.test(titleText)) {
    return true;
  }

  const head = context.trim().slice(0, INTERNSHIP_CONTEXT_HEAD_CHARS);
  return head.length > 0 && FULL_TIME_GRAD_ROLE_PATTERN.test(head);
}

export function hasInternshipSignal(title: string, context = ""): boolean {
  if (matchesInternshipTitle(title)) {
    return true;
  }

  const head = context.trim().slice(0, INTERNSHIP_CONTEXT_HEAD_CHARS);
  if (!head) {
    return false;
  }

  return INTERNSHIP_CONTEXT_PATTERN.test(head);
}

export function hasEngineeringSignal(title: string, context = ""): boolean {
  const titleText = title.trim();
  if (!titleText) {
    return false;
  }

  const contextHead = context.trim().slice(0, ENGINEERING_CONTEXT_HEAD_CHARS);
  return TARGET_ROLE_PATTERNS.some(
    (pattern) => pattern.test(titleText) || (contextHead.length > 0 && pattern.test(contextHead)),
  );
}

export function isNonTargetRoleTitle(title: string): boolean {
  const titleText = title.trim();
  if (!titleText) {
    return false;
  }
  return NON_TARGET_ROLE_PATTERNS.some((pattern) => pattern.test(titleText));
}

export function isTargetEngineeringInternshipRole(title: string, context = ""): boolean {
  const titleText = title.trim();
  if (!titleText) {
    return false;
  }

  if (!hasInternshipSignal(titleText, context)) {
    return false;
  }
  if (isNonTargetRoleTitle(titleText)) {
    return false;
  }

  return hasEngineeringSignal(titleText, context);
}
