import type { CompanySourceConfig } from "../types.ts";

const SCRAPER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
/** Per-request ceiling; large Greenhouse boards and rate-limited ATS APIs can exceed 8s. */
const SOURCE_TIMEOUT_MS = 20_000;
const FETCH_MAX_ATTEMPTS = 3;
const FETCH_RETRY_DELAY_MS = 1000;
const FETCH_RETRY_MAX_DELAY_MS = 30_000;

interface FetchWithTimeoutOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export function atsJsonHeaders(): HeadersInit {
  return {
    accept: "application/json",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": SCRAPER_USER_AGENT,
  };
}

/** Browser-like headers for HTML document fetches (careers pages behind edge WAFs). */
export function scraperHtmlHeaders(referer?: string): HeadersInit {
  return {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": referer ? "same-origin" : "none",
    ...(referer
      ? { referer }
      : { "sec-fetch-user": "?1", "upgrade-insecure-requests": "1" }),
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

export function isRetryableFetchError(error: unknown): boolean {
  if (isAbortError(error)) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as { cause?: unknown }).cause;
  const causeRecord =
    cause && typeof cause === "object"
      ? (cause as { code?: unknown; message?: unknown })
      : null;
  const detail = [
    error.name,
    error.message,
    typeof causeRecord?.code === "string" ? causeRecord.code : "",
    typeof causeRecord?.message === "string" ? causeRecord.message : "",
  ].join(" ");

  return /\b(fetch failed|network|timeout|terminated|other side closed|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|UND_ERR)\b/i.test(
    detail,
  );
}

export function scraperDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableFetchStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /** Cloudflare origin error — common when Workday tenants are in rolling maintenance. */
    status === 520
  );
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) {
    return null;
  }

  const seconds = Number.parseInt(header.trim(), 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return null;
}

export function computeFetchRetryDelayMs(
  attempt: number,
  response?: Pick<Response, "headers"> | null,
  baseDelayMs = FETCH_RETRY_DELAY_MS,
): number {
  const retryAfterMs = parseRetryAfterMs(response?.headers.get("retry-after") ?? null);
  if (retryAfterMs !== null) {
    return Math.min(retryAfterMs, FETCH_RETRY_MAX_DELAY_MS);
  }

  const exponentialDelay = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(exponentialDelay, FETCH_RETRY_MAX_DELAY_MS);
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? FETCH_MAX_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? SOURCE_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? FETCH_RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (!isRetryableFetchStatus(response.status) || attempt >= maxAttempts) {
        return response;
      }

      await scraperDelay(computeFetchRetryDelayMs(attempt, response, retryDelayMs));
    } catch (error) {
      lastError = error;
      if (!isRetryableFetchError(error) || attempt >= maxAttempts) {
        throw error;
      }
      await scraperDelay(computeFetchRetryDelayMs(attempt, null, retryDelayMs));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

export async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  return fetchWithTimeout(
    url,
    {
      ...init,
      headers: {
        ...atsJsonHeaders(),
        ...(init.headers ?? {}),
      },
    },
    options,
  );
}

export interface FetchPayloadResult<T> {
  response: Response;
  data: T;
}

/**
 * Fetch JSON and parse the body inside the retry loop. Large ATS payloads (e.g.
 * ClearCompany) can close the socket mid-read; retrying only the initial fetch
 * does not help because body consumption happens afterward.
 */
export async function fetchJsonPayloadWithTimeout<T = unknown>(
  url: string,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {},
): Promise<FetchPayloadResult<T>> {
  return fetchResponsePayloadWithTimeout(url, init, (response) => response.json() as Promise<T>, options);
}

/** Same retry semantics as {@link fetchJsonPayloadWithTimeout} for HTML/text bodies. */
export async function fetchTextPayloadWithTimeout(
  url: string,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {},
): Promise<FetchPayloadResult<string>> {
  return fetchResponsePayloadWithTimeout(url, init, (response) => response.text(), options);
}

async function fetchResponsePayloadWithTimeout<T>(
  url: string,
  init: RequestInit,
  readBody: (response: Response) => Promise<T>,
  options: FetchWithTimeoutOptions = {},
): Promise<FetchPayloadResult<T>> {
  const maxAttempts = options.maxAttempts ?? FETCH_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? FETCH_RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init, {
        ...options,
        maxAttempts: 1,
      });

      if (!response.ok) {
        if (isRetryableFetchStatus(response.status) && attempt < maxAttempts) {
          await scraperDelay(computeFetchRetryDelayMs(attempt, response, retryDelayMs));
          continue;
        }
        return { response, data: null as T };
      }

      const data = await readBody(response);
      return { response, data };
    } catch (error) {
      lastError = error;
      if (!isRetryableFetchError(error) || attempt >= maxAttempts) {
        throw error;
      }
      await scraperDelay(computeFetchRetryDelayMs(attempt, null, retryDelayMs));
    }
  }

  throw lastError;
}

function normalizeToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
