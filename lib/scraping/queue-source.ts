import type { QueueCompany } from "./integration-queue.ts";
import type { ScrapeSourceConfig, SourceType } from "./types.ts";

const AUTO_APPLY_TIERS = new Set<QueueCompany["tier"]>(["greenhouse", "lever", "ashby"]);

export function canAutoApplyFromQueue(company: QueueCompany): boolean {
  if (!AUTO_APPLY_TIERS.has(company.tier)) return false;
  return Boolean(company.boardToken?.trim());
}

export function queueCompanyToSourceConfig(company: QueueCompany): ScrapeSourceConfig {
  if (!canAutoApplyFromQueue(company)) {
    throw new Error(
      `Cannot auto-apply "${company.slug}" (tier=${company.tier}). Standard ATS rows need boardToken; custom tiers need a PR with adapter code.`,
    );
  }

  const boardToken = company.boardToken!.trim();
  const sourceType = company.tier as SourceType;
  const adapterKey = company.adapterKey?.trim() || `${company.slug}-${company.tier}`;

  return {
    companySlug: company.slug,
    companyName: company.name,
    sourceType,
    adapterKey,
    sourceUrl: resolveSourceUrl(company, boardToken),
    boardToken,
  };
}

function resolveSourceUrl(company: QueueCompany, boardToken: string): string {
  if (company.careersUrl && isAtsBoardUrl(company.careersUrl, company.tier)) {
    return company.careersUrl;
  }
  if (company.tier === "greenhouse") {
    return `https://boards.greenhouse.io/${boardToken}`;
  }
  if (company.tier === "lever") {
    return `https://jobs.lever.co/${boardToken}`;
  }
  if (company.tier === "ashby") {
    return `https://jobs.ashbyhq.com/${boardToken}`;
  }
  return company.careersUrl ?? `https://${boardToken}.example.com`;
}

function isAtsBoardUrl(url: string, tier: QueueCompany["tier"]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (tier === "greenhouse") {
      return host.includes("greenhouse.io");
    }
    if (tier === "lever") {
      return host.includes("lever.co");
    }
    if (tier === "ashby") {
      return host.includes("ashbyhq.com");
    }
  } catch {
    return false;
  }
  return false;
}
