/**
 * Browser-only queue for `/api/logo` fetches. Discover and Live can mount
 * hundreds of logos at once; without a cap, the client opens a burst of
 * parallel requests and logo.dev / the proxy return 403/503.
 */

export type LogoProxyFetchOutcome = "ok" | "missing" | "retryable";

const DEFAULT_MAX_CONCURRENT = 4;
const DEFAULT_MIN_START_GAP_MS = 50;

type QueueJob = {
  url: string;
  cacheKey: string;
  resolve: (outcome: LogoProxyFetchOutcome) => void;
};

type QueueState = {
  maxConcurrent: number;
  minStartGapMs: number;
  memoryCache: Map<string, LogoProxyFetchOutcome>;
  inflight: Map<string, Promise<LogoProxyFetchOutcome>>;
  queue: QueueJob[];
  active: number;
  lastStartAt: number;
  drainTimer: ReturnType<typeof setTimeout> | null;
};

const QUEUE_KEY = Symbol.for("internship-tracker.logo-fetch-queue");

function getState(): QueueState {
  const g = globalThis as typeof globalThis & { [QUEUE_KEY]?: QueueState };
  if (!g[QUEUE_KEY]) {
    g[QUEUE_KEY] = {
      maxConcurrent: DEFAULT_MAX_CONCURRENT,
      minStartGapMs: DEFAULT_MIN_START_GAP_MS,
      memoryCache: new Map(),
      inflight: new Map(),
      queue: [],
      active: 0,
      lastStartAt: 0,
      drainTimer: null,
    };
  }
  return g[QUEUE_KEY];
}

function outcomeFromResponse(status: number): LogoProxyFetchOutcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404) return "missing";
  return "retryable";
}

async function runFetch(url: string): Promise<LogoProxyFetchOutcome> {
  const response = await fetch(url, { credentials: "include" });
  return outcomeFromResponse(response.status);
}

function scheduleDrain(state: QueueState) {
  if (state.drainTimer !== null) return;

  const tick = () => {
    state.drainTimer = null;

    while (state.active < state.maxConcurrent && state.queue.length > 0) {
      const elapsed = Date.now() - state.lastStartAt;
      const waitMs = state.minStartGapMs - elapsed;
      if (waitMs > 0) {
        state.drainTimer = setTimeout(tick, waitMs);
        return;
      }

      const job = state.queue.shift();
      if (!job) return;

      const cached = state.memoryCache.get(job.cacheKey);
      if (cached) {
        job.resolve(cached);
        continue;
      }

      state.active += 1;
      state.lastStartAt = Date.now();

      void runFetch(job.url)
        .then((outcome) => {
          if (outcome === "ok" || outcome === "missing") {
            state.memoryCache.set(job.cacheKey, outcome);
          }
          job.resolve(outcome);
        })
        .catch(() => {
          job.resolve("retryable");
        })
        .finally(() => {
          state.active -= 1;
          scheduleDrain(state);
        });
    }
  };

  tick();
}

function enqueue(state: QueueState, url: string, cacheKey: string): Promise<LogoProxyFetchOutcome> {
  const cached = state.memoryCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existing = state.inflight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = new Promise<LogoProxyFetchOutcome>((resolve) => {
    state.queue.push({ url, cacheKey, resolve });
    scheduleDrain(state);
  }).finally(() => {
    state.inflight.delete(cacheKey);
  });

  state.inflight.set(cacheKey, promise);
  return promise;
}

/** Fetch a logo through `/api/logo` with global concurrency and deduplication. */
export function fetchLogoProxy(url: string, cacheKey: string): Promise<LogoProxyFetchOutcome> {
  return enqueue(getState(), url, cacheKey);
}

/** @internal Test helper */
export function resetLogoProxyFetchQueueForTests(options?: {
  maxConcurrent?: number;
  minStartGapMs?: number;
}): void {
  const g = globalThis as typeof globalThis & { [QUEUE_KEY]?: QueueState };
  const state: QueueState = {
    maxConcurrent: options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
    minStartGapMs: options?.minStartGapMs ?? DEFAULT_MIN_START_GAP_MS,
    memoryCache: new Map(),
    inflight: new Map(),
    queue: [],
    active: 0,
    lastStartAt: 0,
    drainTimer: null,
  };
  g[QUEUE_KEY] = state;
}

/** @internal Test helper */
export function getLogoProxyFetchQueueStateForTests(): Readonly<{
  active: number;
  queued: number;
  cached: number;
}> {
  const state = getState();
  return {
    active: state.active,
    queued: state.queue.length,
    cached: state.memoryCache.size,
  };
}
