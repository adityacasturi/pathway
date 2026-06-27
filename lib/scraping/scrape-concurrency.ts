import type { CompanySourceConfig } from "./types.ts";

const DEFAULT_COMPANY_CONCURRENCY = 8;
const MAX_COMPANY_CONCURRENCY = 16;

/** Shared ATS hosts — cap concurrent scrapes per host to reduce 429s. */
const HOST_CONCURRENCY_LIMITS: Record<string, number> = {
  "boards-api.greenhouse.io": 6,
  "job-boards.greenhouse.io": 6,
  "api.ashbyhq.com": 3,
  "api.lever.co": 3,
  "*.myworkdayjobs.com": 2,
  "www.metacareers.com": 2,
  "www.amazon.jobs": 2,
  "apply.careers.microsoft.com": 2,
  "jobs.apple.com": 2,
  "careers.qualcomm.com": 2,
  "mlp.eightfold.ai": 2,
  "www.linkedin.com": 1,
  "www.tesla.com": 2,
  "www.uber.com": 2,
  "www.asml.com": 2,
  "www.citadel.com": 2,
  "www.twosigma.com": 2,
};

export function readCompanyConcurrency(): number {
  const raw = process.env.SCRAPE_COMPANY_CONCURRENCY;
  if (!raw?.trim()) {
    return DEFAULT_COMPANY_CONCURRENCY;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_COMPANY_CONCURRENCY;
  }
  return Math.min(parsed, MAX_COMPANY_CONCURRENCY);
}

export function resolveScrapeHostKey(config: Pick<CompanySourceConfig, "sourceType" | "sourceUrl">): string {
  try {
    const host = new URL(config.sourceUrl).hostname.toLowerCase();
    if (host.endsWith(".myworkdayjobs.com")) {
      return "*.myworkdayjobs.com";
    }
    if (host) {
      return host;
    }
  } catch {
    // fall through
  }
  return config.sourceType;
}

export function hostConcurrencyLimit(hostKey: string): number {
  return HOST_CONCURRENCY_LIMITS[hostKey] ?? 4;
}

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

export class ScrapeConcurrencyPool {
  private readonly companySemaphore: Semaphore;
  private readonly hostSemaphores = new Map<string, Semaphore>();

  constructor(companyConcurrency = readCompanyConcurrency()) {
    this.companySemaphore = new Semaphore(companyConcurrency);
  }

  run<T>(hostKey: string, fn: () => Promise<T>): Promise<T> {
    return this.companySemaphore.run(() => this.hostSemaphore(hostKey).run(fn));
  }

  private hostSemaphore(hostKey: string): Semaphore {
    let semaphore = this.hostSemaphores.get(hostKey);
    if (!semaphore) {
      semaphore = new Semaphore(hostConcurrencyLimit(hostKey));
      this.hostSemaphores.set(hostKey, semaphore);
    }
    return semaphore;
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
