import {
  normalizeGeoKey,
  normalizeCountryCode,
  parseCountryToken,
  parseRegionToken,
  US_STATE_CODES,
  US_STATE_NAMES,
} from "./countries.ts";

const OFFICE_PREFIX_PATTERN = /^(?:MSB|HQ|Office|X)\s*,\s*/i;
const PARENTHETICAL_PATTERN = /\s*\([^)]*\)/g;
const ATS_DESCRIPTOR_PREFIX_PATTERN = /^([A-Z]{2})-(.+)$/i;

/** "Singapore, Singapore, Singapore" → "Singapore". */
export function collapseRepeatedCommaParts(raw: string): string {
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return raw.trim();
  }

  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (!unique.some((existing) => existing.toLowerCase() === key)) {
      unique.push(part);
    }
  }

  return unique.join(", ");
}

function normalizeCountrySpacing(value: string): string {
  return value.replace(/,([^\s,])/g, ", $1");
}

function titleCaseDescriptorPart(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function stripWorkdayNoise(value: string): string {
  const segment = value.split("~")[0]?.trim() ?? value;
  const descriptor = segment.split(",")[0]?.trim() ?? segment;
  const descriptorMatch = descriptor.match(ATS_DESCRIPTOR_PREFIX_PATTERN);
  if (descriptorMatch) {
    const country = normalizeCountryCode(descriptorMatch[1]);
    const parts = (descriptorMatch[2] ?? "").split("-").map((part) => part.trim()).filter(Boolean);
    if (!country || parts.length === 0) {
      return segment.trim();
    }

    if (country === "US") {
      const region = parts[0]?.toUpperCase() ?? "";
      const city = titleCaseDescriptorPart(parts[1] ?? "");
      if (city && US_STATE_CODES.has(region)) {
        return `${city}, ${region}, US`;
      }
      return segment.trim();
    }

    const first = parts[0] ?? "";
    const cityRaw =
      parts.length >= 2 && /^[A-Z0-9]{1,3}$/i.test(first)
        ? parts[1]
        : first;
    const city = titleCaseDescriptorPart(cityRaw ?? "");
    if (city) {
      return `${city}, ${country}`;
    }
    return segment.trim();
  }
  return segment.trim();
}

function dedupRedundantCountryTokens(parts: string[]): string[] {
  if (parts.length < 2) return parts;

  const countryTokens: Array<{ index: number; code: string }> = [];
  for (let i = 0; i < parts.length; i++) {
    const code = parseCountryToken(parts[i] ?? "");
    if (code) {
      countryTokens.push({ index: i, code });
    }
  }

  if (countryTokens.length <= 1) return parts;

  const lastCountry = countryTokens.at(-1);
  const lastNonUsCountry = countryTokens.findLast((token) => token.code !== "US");
  if (lastCountry?.code === "US" && lastNonUsCountry) {
    return parts.filter((part, index) => {
      if (index === lastNonUsCountry.index) return true;
      return !countryTokens.some((token) => token.index === index);
    });
  }

  const keepLastCountry = lastCountry?.index ?? countryTokens.at(-1)!.index;
  return parts.filter((part, index) => {
    if (!countryTokens.some((token) => token.index === index)) return true;
    return index === keepLastCountry;
  });
}

function normalizeUsCountryFirstParts(parts: string[]): string[] {
  if (parts.length === 3 && parseCountryToken(parts[2] ?? "") === "US") {
    const middle = parts[1] ?? "";
    if (!parseRegionToken(middle, "US")) {
      const region = US_STATE_NAMES[normalizeGeoKey(parts[0] ?? "")];
      if (region) {
        return [middle, region, "US"];
      }
    }
  }

  if (parts.length < 3) return parts;

  const first = parts[0]?.trim().toUpperCase() ?? "";
  const lastCountry = parseCountryToken(parts.at(-1) ?? "");
  if (first !== "US" && first !== "USA") return parts;
  if (lastCountry !== "US" && !/^united states$/i.test(parts.at(-1) ?? "")) {
    return parts;
  }

  const middle = parts.slice(1, -1);
  if (middle.length === 2) {
    const [stateName, city] = middle;
    const region = US_STATE_NAMES[normalizeGeoKey(stateName ?? "")];
    if (region) {
      return [city ?? "", region, "US"];
    }
  }

  if (middle.length === 1) {
    return [middle[0] ?? "", "US"];
  }

  if (parts.length === 3 && first === "US") {
    const stateName = parts[1] ?? "";
    const city = parts[2] ?? "";
    const region = US_STATE_NAMES[normalizeGeoKey(stateName)];
    if (region) {
      return [city, region, "US"];
    }
  }

  return parts;
}

function reorderCountryFirst(parts: string[]): string[] {
  if (parts.length !== 2) return parts;

  const [first, second] = parts;
  const firstCountry = parseCountryToken(first ?? "");
  const secondCountry = parseCountryToken(second ?? "");
  const secondRegion = parseRegionToken(second ?? "", null);

  if (firstCountry && !secondCountry && !secondRegion) {
    return [second ?? "", first ?? ""];
  }

  if (firstCountry && secondRegion && !parseCountryToken(second ?? "")) {
    return [second ?? "", first ?? ""];
  }

  return parts;
}

function stripSingleLetterAdminCodes(parts: string[]): string[] {
  if (parts.length < 3) return parts;
  return parts.filter((part, index) => {
    if (index === 0 || index === parts.length - 1) return true;
    const trimmed = part.trim();
    if (parseCountryToken(trimmed) || parseRegionToken(trimmed, null)) {
      return true;
    }
    if (trimmed.length === 1 && /^[A-Z]$/i.test(trimmed)) {
      return false;
    }
    if (/^\d{1,3}$/.test(trimmed)) {
      return false;
    }
    return true;
  });
}

function titleCaseIfAllCaps(value: string): string {
  if (!/^[A-Z\s,.-]+$/.test(value) || value.length > 48) {
    return value;
  }
  return value
    .split(",")
    .map((segment) =>
      segment
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" "),
    )
    .join(", ");
}

/** Pre-parse cleanup for messy ATS location strings. */
export function sanitizeLocationInput(raw: string): string {
  let value = raw.replace(/\s+/g, " ").trim();
  if (!value) return "";

  value = stripWorkdayNoise(value);
  value = value.replace(OFFICE_PREFIX_PATTERN, "");
  value = value.replace(PARENTHETICAL_PATTERN, "").trim();
  value = normalizeCountrySpacing(value);
  value = value.replace(/\bD\.C\.?\b/gi, "DC");
  value = collapseRepeatedCommaParts(value);
  value = titleCaseIfAllCaps(value);

  let parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  parts = dedupRedundantCountryTokens(parts);
  parts = normalizeUsCountryFirstParts(parts);
  parts = reorderCountryFirst(parts);
  parts = stripSingleLetterAdminCodes(parts);

  return parts.join(", ");
}

export function splitLocationInput(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\s*·\s*|\s*\|\s*|\s*;\s*|\s*\/\s*(?=\s*[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
}
