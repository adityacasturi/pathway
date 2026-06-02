import { isSourceType, type SourceType } from "../../lib/scraping/types.ts";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface DiscoverCompanyPlan {
  apply: boolean;
  scrape: boolean;
  company: {
    slug: string;
    name: string;
    website_url: string | null;
    careers_url: string | null;
    industry: string;
    is_active: true;
    logo_asset_key: string | null;
  };
  source: {
    source_type: SourceType;
    adapter_key: string;
    source_url: string;
    board_token: string | null;
    enabled: boolean;
    scrape_interval_minutes: 15;
  };
}

export interface DiscoverCompanyInput {
  slug: string;
  name: string;
  websiteUrl?: string | null;
  careersUrl?: string | null;
  industry?: string | null;
  logoAssetKey?: string | null;
  sourceType: string;
  adapterKey?: string | null;
  sourceUrl: string;
  boardToken?: string | null;
  enabled?: boolean;
  apply?: boolean;
  scrape?: boolean;
}

export function parseDiscoverCompanyArgs(argv: string[]): DiscoverCompanyPlan {
  const flags = parseFlags(argv);

  return buildDiscoverCompanyPlan({
    slug: requiredFlag(flags, "slug"),
    name: requiredFlag(flags, "name"),
    websiteUrl: optionalFlag(flags, "website", "website-url", "websiteUrl"),
    careersUrl: optionalFlag(flags, "careers", "careers-url", "careersUrl"),
    industry: optionalFlag(flags, "industry"),
    logoAssetKey: optionalFlag(flags, "logo-asset-key", "logoAssetKey"),
    sourceType: requiredFlag(flags, "source-type", "sourceType"),
    adapterKey: optionalFlag(flags, "adapter-key", "adapterKey"),
    sourceUrl: requiredFlag(flags, "source-url", "sourceUrl"),
    boardToken: optionalFlag(flags, "board-token", "boardToken"),
    enabled: parseEnabledFlag(flags),
    apply: hasFlag(flags, "apply"),
    scrape: hasFlag(flags, "scrape"),
  });
}

export function buildDiscoverCompanyPlan(input: DiscoverCompanyInput): DiscoverCompanyPlan {
  const slug = normalizeSlug(input.slug, "slug");
  const name = normalizeRequiredText(input.name, "name");
  const sourceType = normalizeSourceType(input.sourceType);
  const adapterKey = normalizeOptionalText(input.adapterKey, "adapter-key") ?? sourceType;
  const industry = normalizeSlug(input.industry ?? "enterprise-software", "industry");
  const logoAssetKey = normalizeOptionalSlug(input.logoAssetKey, "logo-asset-key");

  return {
    apply: input.apply === true,
    scrape: input.scrape === true,
    company: {
      slug,
      name,
      website_url: normalizeOptionalUrl(input.websiteUrl, "website"),
      careers_url: normalizeOptionalUrl(input.careersUrl, "careers"),
      industry,
      is_active: true,
      logo_asset_key: logoAssetKey,
    },
    source: {
      source_type: sourceType,
      adapter_key: adapterKey,
      source_url: normalizeRequiredUrl(input.sourceUrl, "source-url"),
      board_token: normalizeOptionalText(input.boardToken, "board-token"),
      enabled: input.enabled !== false,
      scrape_interval_minutes: 15,
    },
  };
}

function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, "true");
      continue;
    }

    flags.set(key, next);
    index += 1;
  }

  return flags;
}

function hasFlag(flags: Map<string, string>, key: string): boolean {
  return flags.get(key) === "true";
}

function requiredFlag(flags: Map<string, string>, ...keys: string[]): string {
  const value = optionalFlag(flags, ...keys);
  if (!value) {
    throw new Error(`Missing required --${keys[0]}`);
  }
  return value;
}

function optionalFlag(flags: Map<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = flags.get(key);
    if (value && value !== "true") {
      return value;
    }
  }
  return null;
}

function parseEnabledFlag(flags: Map<string, string>): boolean {
  if (hasFlag(flags, "enabled") && hasFlag(flags, "disabled")) {
    throw new Error("Use either --enabled or --disabled, not both");
  }
  return !hasFlag(flags, "disabled");
}

function normalizeSourceType(value: string): SourceType {
  const normalized = normalizeRequiredText(value, "source-type");
  if (!isSourceType(normalized)) {
    throw new Error(`Invalid source-type: ${normalized}`);
  }
  return normalized;
}

function normalizeOptionalSlug(value: string | null | undefined, field: string): string | null {
  const normalized = normalizeOptionalText(value, field);
  return normalized ? normalizeSlug(normalized, field) : null;
}

function normalizeSlug(value: string, field: string): string {
  const normalized = normalizeRequiredText(value, field);
  if (!SLUG_PATTERN.test(normalized)) {
    throw new Error(`Invalid ${field}: expected lowercase slug`);
  }
  return normalized;
}

function normalizeRequiredUrl(value: string, field: string): string {
  const normalized = normalizeOptionalUrl(value, field);
  if (!normalized) {
    throw new Error(`Missing required --${field}`);
  }
  return normalized;
}

function normalizeOptionalUrl(value: string | null | undefined, field: string): string | null {
  const normalized = normalizeOptionalText(value, field);
  if (!normalized) return null;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(`Invalid ${field}: expected http(s) URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid ${field}: expected http(s) URL`);
  }
  return url.toString();
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = normalizeOptionalText(value, field);
  if (!normalized) {
    throw new Error(`Missing required --${field}`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Invalid ${field}: value cannot be blank`);
  }
  return normalized;
}
