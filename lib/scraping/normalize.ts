import { createHash } from "node:crypto";
import { detectCountriesAcross } from "../feed/location.ts";

export type PostingSeason = "Summer" | "Fall" | "Spring" | "Winter" | "Year-round" | "Unknown";
export type SeasonSource = "ats_field" | "title" | "description" | "inferred" | "unknown";

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set([
  "gh_src",
  "lever-source",
  "source",
  "ref",
  "referrer",
  "trk",
]);

export function canonicalizePostingUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.hash = "";

    for (const key of Array.from(url.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
        url.searchParams.delete(key);
      }
    }

    url.hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$/, "");
    url.pathname = pathname || "/";
    const serialized = url.toString();
    return serialized.endsWith("/") && url.pathname === "/"
      ? serialized.slice(0, -1)
      : serialized;
  } catch {
    return trimmed;
  }
}

export function normalizeRoleName(rawTitle: string): string {
  return rawTitle
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—|]\s*(Summer|Fall|Spring|Winter)\s+\d{4}\s*$/i, "")
    .replace(/\s*\((Summer|Fall|Spring|Winter)\s+\d{4}\)\s*$/i, "")
    .trim();
}

export function inferSeason(
  title: string,
  description = "",
): { season: PostingSeason; seasonYear: number | null; seasonSource: SeasonSource } {
  const sources: Array<[string, SeasonSource]> = [
    [title, "title"],
    [description, "description"],
  ];

  for (const [text, source] of sources) {
    const match = /\b(Summer|Fall|Spring|Winter)\s+(20\d{2})\b/i.exec(text);
    if (!match) continue;
    return {
      season: normalizeSeason(match[1]),
      seasonYear: Number.parseInt(match[2], 10),
      seasonSource: source,
    };
  }

  for (const [text, source] of sources) {
    const monthRange = inferSeasonFromMonthRange(text);
    if (!monthRange) continue;
    return {
      season: monthRange,
      seasonYear: inferYear(text) ?? inferYear(`${title} ${description}`),
      seasonSource: source,
    };
  }

  if (/\byear[-\s]?round\b/i.test(`${title} ${description}`)) {
    return { season: "Year-round", seasonYear: null, seasonSource: "inferred" };
  }

  return { season: "Summer", seasonYear: null, seasonSource: "unknown" };
}

export function normalizeLocations(rawLocations: readonly string[] | string | null | undefined): {
  locations: string[];
  countries: string[];
  isRemote: boolean;
  locationRaw: string | null;
} {
  const values = Array.isArray(rawLocations)
    ? rawLocations
    : typeof rawLocations === "string"
      ? rawLocations.split(/\s*(?:\||;|•)\s*/g)
      : [];
  const locations = Array.from(
    new Set(values.map((location) => location.replace(/\s+/g, " ").trim()).filter(Boolean)),
  );

  return {
    locations,
    countries: detectCountries(locations),
    isRemote: locations.some((location) => /\bremote\b/i.test(location)),
    locationRaw: locations.length > 0 ? locations.join(" · ") : null,
  };
}

export function contentHash(payload: Record<string, unknown>): string {
  return createHash("sha256")
    .update(stableSerialize(normalizeHashPayload(payload)))
    .digest("hex");
}

function normalizeSeason(value: string): PostingSeason {
  const normalized = value[0].toUpperCase() + value.slice(1).toLowerCase();
  if (["Summer", "Fall", "Spring", "Winter"].includes(normalized)) {
    return normalized as PostingSeason;
  }
  return "Unknown";
}

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function inferSeasonFromMonthRange(text: string): PostingSeason | null {
  const month =
    "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const optionalYear = "(?:\\s+20\\d{2})?";
  const rangePattern = new RegExp(
    `\\b${month}${optionalYear}\\s*(?:-|–|—|to|through|thru|until|/)\\s*${month}${optionalYear}\\b`,
    "i",
  );
  const match = rangePattern.exec(text);
  if (!match) return null;

  const start = monthNumber(match[1]);
  const end = monthNumber(match[2]);
  if (!start || !end) return null;

  if (monthsOverlap(start, end, [5, 6, 7, 8])) return "Summer";
  if (monthsOverlap(start, end, [9, 10, 11])) return "Fall";
  if (monthsOverlap(start, end, [1, 2, 12])) return "Winter";
  if (monthsOverlap(start, end, [3, 4])) return "Spring";
  return null;
}

function monthNumber(value: string): number | null {
  return MONTH_INDEX[value.toLowerCase().replace(/\.$/, "")] ?? null;
}

function monthsOverlap(start: number, end: number, targetMonths: number[]): boolean {
  const months: number[] = [];
  let current = start;
  for (let i = 0; i < 12; i += 1) {
    months.push(current);
    if (current === end) break;
    current = current === 12 ? 1 : current + 1;
  }
  return targetMonths.some((month) => months.includes(month));
}

function inferYear(text: string): number | null {
  const match = /\b(20\d{2})\b/.exec(text);
  return match ? Number.parseInt(match[1], 10) : null;
}

function normalizeHashPayload(value: unknown): unknown {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return canonicalizePostingUrl(value);
    return value.trim().replace(/\s+/g, " ");
  }

  if (Array.isArray(value)) {
    return value.map(normalizeHashPayload).sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b)));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      out[key] = normalizeHashPayload(nested);
    }
    return out;
  }

  return value;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function detectCountries(locations: string[]): string[] {
  return detectCountriesAcross(locations);
}

export function isInternshipTitle(title: string): boolean {
  return /\b(intern|internship|co-?op)\b/i.test(title);
}

/** Only scan the start of context so full ATS descriptions do not create false positives. */
const INTERNSHIP_CONTEXT_HEAD_CHARS = 200;

const INTERNSHIP_CONTEXT_PATTERN =
  /\b(?:summer|fall|winter|spring)?\s*(?:internship|co-?op)\b|\bindustrial placement year\b/i;

function hasInternshipSignal(title: string, context: string): boolean {
  if (isInternshipTitle(title)) return true;
  const head = context.trim().slice(0, INTERNSHIP_CONTEXT_HEAD_CHARS);
  if (!head) return false;
  return INTERNSHIP_CONTEXT_PATTERN.test(head);
}

const TARGET_ROLE_PATTERNS = [
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
  /\bresearch\b/i,
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
];

const NON_TARGET_ROLE_PATTERNS = [
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

export function isTargetEngineeringInternshipRole(
  title: string,
  context = "",
): boolean {
  const titleText = title.trim();
  if (!titleText) return false;

  if (!hasInternshipSignal(titleText, context)) return false;
  if (NON_TARGET_ROLE_PATTERNS.some((pattern) => pattern.test(titleText))) return false;

  const contextHead = context.trim().slice(0, 500);
  return TARGET_ROLE_PATTERNS.some(
    (pattern) => pattern.test(titleText) || (contextHead.length > 0 && pattern.test(contextHead)),
  );
}
