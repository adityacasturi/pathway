import type { CompanySourceConfig } from "../types.ts";

const SCRAPER_USER_AGENT = "Pathway internship tracker scraper (+https://pathway.app)";
/** Per-request ceiling; large Greenhouse boards and rate-limited ATS APIs can exceed 8s. */
const SOURCE_TIMEOUT_MS = 20_000;
const FETCH_MAX_ATTEMPTS = 2;
const FETCH_RETRY_DELAY_MS = 1000;

export function atsJsonHeaders(): HeadersInit {
  return {
    accept: "application/json",
    "user-agent": SCRAPER_USER_AGENT,
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function safeToIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function resolveBoardToken(
  source: CompanySourceConfig,
  deriveFromSourceUrl: (sourceUrl: string) => string | null,
): string {
  const explicit = normalizeToken(source.boardToken);
  if (explicit) return explicit;

  const fromUrl = normalizeToken(deriveFromSourceUrl(source.sourceUrl));
  if (fromUrl) return fromUrl;

  const fromSlug = normalizeToken(source.companySlug);
  if (fromSlug) return fromSlug;

  throw new Error(`Unable to resolve board token for adapter ${source.adapterKey}`);
}

export function parseLeadingPathToken(sourceUrl: string, hosts?: string[]): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (hosts && hosts.length > 0 && !hosts.includes(hostname)) {
      return null;
    }

    const firstSegment = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean)[0];
    return firstSegment || null;
  } catch {
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "AbortError" || error.message.includes("aborted");
}

export function scraperDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJsonWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...atsJsonHeaders(),
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      lastError = error;
      if (!isAbortError(error) || attempt >= FETCH_MAX_ATTEMPTS) {
        throw error;
      }
      await scraperDelay(FETCH_RETRY_DELAY_MS);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function normalizeToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
