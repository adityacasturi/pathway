import { discoverAtsFromCareersPage } from "./discover-ats.ts";
import { discoverCareersUrl } from "./discover-careers.ts";
import { applyCompanyFromQueue } from "./integration-apply.ts";
import {
  blockCompany,
  loadQueue,
  saveQueue,
  type QueueCompany,
} from "./integration-queue.ts";

export interface DiscoverApplyReport {
  slug: string;
  ok: boolean;
  discovery?: {
    tier: string;
    boardToken: string;
    sourceUrl: string;
    evidence: string;
  };
  postingsFound: number;
  steps: Array<{ name: string; ok: boolean; detail: string }>;
}

export async function discoverAndApplyCompanyFromQueue(
  slug: string,
  options: { writeMigration?: boolean; minFound?: number } = {},
): Promise<DiscoverApplyReport> {
  const normalized = slug.trim().toLowerCase();
  const steps: DiscoverApplyReport["steps"] = [];
  const queue = loadQueue();
  const company = queue.companies.find((entry) => entry.slug === normalized);

  if (!company) {
    return {
      slug: normalized,
      ok: false,
      postingsFound: 0,
      steps: [{ name: "queue_lookup", ok: false, detail: `Unknown slug "${normalized}"` }],
    };
  }

  if (company.tier === "custom") {
    return fail(queue, company, steps, "discover_careers", "tier=custom — block for manual adapter work");
  }

  const careersUrl = await resolveCareersUrlForCompany(company, steps);
  if (!careersUrl) {
    const reason =
      steps.find((step) => step.name === "discover_careers" && !step.ok)?.detail ??
      "Could not resolve careers page";
    blockCompany(queue, normalized, reason);
    saveQueue(queue);
    return { slug: normalized, ok: false, postingsFound: 0, steps };
  }

  saveQueue(queue);

  const needsAtsDiscovery = company.tier === "discover" || !company.boardToken?.trim();
  if (needsAtsDiscovery) {
    const discovered = await discoverAtsFromCareersPage(careersUrl, company.slug);
    steps.push({
      name: "discover_ats",
      ok: discovered.ok,
      detail: discovered.ok
        ? `${discovered.discovery.tier} token=${discovered.discovery.boardToken} (${discovered.discovery.evidence})`
        : discovered.reason,
    });

    if (!discovered.ok) {
      blockCompany(queue, normalized, discovered.reason);
      saveQueue(queue);
      return { slug: normalized, ok: false, postingsFound: 0, steps };
    }

    applyDiscoveryToCompany(company, discovered.discovery);
    saveQueue(queue);
  } else {
    steps.push({
      name: "discover_ats",
      ok: true,
      detail: `Using existing ${company.tier} boardToken=${company.boardToken}`,
    });
  }

  const applyReport = await applyCompanyFromQueue(normalized, options);
  return {
    slug: normalized,
    ok: applyReport.ok,
    discovery: needsAtsDiscovery && company.boardToken
      ? {
          tier: company.tier,
          boardToken: company.boardToken,
          sourceUrl: queueCompanyBoardUrl(company),
          evidence: company.notes ?? "",
        }
      : undefined,
    postingsFound: applyReport.postingsFound,
    steps: [...steps, ...applyReport.steps],
  };
}

async function resolveCareersUrlForCompany(
  company: QueueCompany,
  steps: DiscoverApplyReport["steps"],
): Promise<string | null> {
  const careers = await discoverCareersUrl({
    slug: company.slug,
    name: company.name,
    careersUrl: company.careersUrl,
    domain: company.domain,
  });

  steps.push({
    name: "discover_careers",
    ok: careers.ok,
    detail: careers.ok ? `${careers.careersUrl} (${careers.evidence})` : careers.reason,
  });

  if (!careers.ok) return null;

  if (!company.careersUrl?.trim()) {
    company.careersUrl = careers.careersUrl;
  }

  return careers.careersUrl;
}

export function applyDiscoveryToCompany(
  company: QueueCompany,
  discovery: {
    tier: "greenhouse" | "lever" | "ashby";
    boardToken: string;
    sourceUrl: string;
    adapterKey: string;
    evidence: string;
  },
): void {
  company.tier = discovery.tier;
  company.boardToken = discovery.boardToken;
  company.sourceType = discovery.tier;
  company.adapterKey = discovery.adapterKey;
  company.notes = `Discovered ATS (${discovery.sourceUrl}): ${discovery.evidence}`;
}

export function resetPendingAtsGuesses(queue = loadQueue()): string[] {
  const reset: string[] = [];
  for (const company of queue.companies) {
    if (company.status !== "pending" && company.status !== "blocked") continue;
    if (!company.autoApprove || company.tier === "custom") continue;
    if (company.tier === "discover" && !company.boardToken) continue;

    company.tier = "discover";
    company.boardToken = undefined;
    company.adapterKey = undefined;
    company.blockedReason = undefined;
    if (company.status === "blocked") {
      company.status = "pending";
    }
    company.notes = "Awaiting ATS discovery from careers page";
    reset.push(company.slug);
  }
  return reset;
}

export function clearCareersUrlHints(queue = loadQueue()): string[] {
  const cleared: string[] = [];
  for (const company of queue.companies) {
    if (company.status !== "pending" && company.status !== "blocked") continue;
    if (company.tier === "custom") continue;
    if (!company.careersUrl?.trim()) continue;

    company.careersUrl = undefined;
    cleared.push(company.slug);
  }
  return cleared;
}

function queueCompanyBoardUrl(company: QueueCompany): string {
  const token = company.boardToken?.trim() ?? "";
  if (company.tier === "greenhouse") return `https://job-boards.greenhouse.io/${token}`;
  if (company.tier === "lever") return `https://jobs.lever.co/${token}`;
  if (company.tier === "ashby") return `https://jobs.ashbyhq.com/${token}`;
  return company.careersUrl ?? "";
}

function fail(
  queue: ReturnType<typeof loadQueue>,
  company: QueueCompany,
  steps: DiscoverApplyReport["steps"],
  stepName: string,
  reason: string,
): DiscoverApplyReport {
  steps.push({ name: stepName, ok: false, detail: reason });
  blockCompany(queue, company.slug, reason);
  saveQueue(queue);
  return { slug: company.slug, ok: false, postingsFound: 0, steps };
}
