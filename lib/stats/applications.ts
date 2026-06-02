import type { Application, EventType, Status } from "@/types/application";
import { STATUS_COLORS } from "@/lib/config/status-colors";

export type FlowNode = {
  id: string;
  label: string;
  count: number;
  x: number;
  cy: number;
  color: string;
};

export type FlowLink = {
  id: string;
  source: string;
  target: string;
  value: number;
  color: string;
};

export type MonthlyCount = {
  key: string;
  label: string;
  count: number;
};

export type StageCount = Record<Status, number>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const FLOW_COLORS = {
  applied: "#9b9993",
  oa: "#4e83bf",
  interview: STATUS_COLORS.interview,
  offer: STATUS_COLORS.offer,
  rejected: "#c6684a",
  pending: "#b5b3aa",
} as const;

function hasEvent(application: Application, eventType: EventType) {
  return application.events.some((event) => event.event_type === eventType);
}

function firstEventDate(application: Application, eventType: EventType) {
  return (
    application.events
      .filter((event) => event.event_type === eventType)
      .sort((a, b) => {
        const byDate = a.event_date.localeCompare(b.event_date);
        if (byDate !== 0) return byDate;
        return a.created_at.localeCompare(b.created_at);
      })[0]?.event_date ?? null
  );
}

function applicationStartDate(application: Application) {
  return firstEventDate(application, "applied") ?? application.created_at.slice(0, 10);
}

function dateToMs(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getTime();
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round(((dateToMs(end) - dateToMs(start)) / MS_PER_DAY) * 10) / 10);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function sampleDetail(count: number) {
  return `${count} ${pluralize(count, "application")} sample`;
}

export function formatDays(days: number | null) {
  if (days == null) return "n/a";
  const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${rounded}d`;
}

export function formatDecimal(value: number | null) {
  if (value == null) return "n/a";
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

export function formatPercent(numerator: number, denominator: number) {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function addMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function buildMonthlyCounts(applications: Application[]): MonthlyCount[] {
  const counts = new Map<string, number>();
  for (const application of applications) {
    const key = monthKey(applicationStartDate(application));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const keys = [...counts.keys()].sort();
  if (keys.length === 0) return [];

  const months: MonthlyCount[] = [];
  let cursor = keys[0];
  const last = keys[keys.length - 1];
  while (cursor <= last) {
    months.push({ key: cursor, label: monthLabel(cursor), count: counts.get(cursor) ?? 0 });
    cursor = addMonth(cursor);
  }

  return months.slice(-12);
}

function firstProgressDate(application: Application) {
  return (
    application.events
      .filter((event) => event.event_type !== "applied" && event.event_type !== "note")
      .sort((a, b) => {
        const byDate = a.event_date.localeCompare(b.event_date);
        if (byDate !== 0) return byDate;
        return a.created_at.localeCompare(b.created_at);
      })[0]?.event_date ?? null
  );
}

function hasProgress(application: Application) {
  return firstProgressDate(application) != null;
}

function hasTerminalDecision(application: Application) {
  return hasEvent(application, "offer") || hasEvent(application, "rejected");
}

function buildStageCounts(applications: Application[]): StageCount {
  return {
    applied: applications.length,
    oa: applications.filter((application) => hasEvent(application, "oa")).length,
    interview: applications.filter((application) => hasEvent(application, "interview")).length,
    offer: applications.filter((application) => hasEvent(application, "offer")).length,
    rejected: applications.filter((application) => hasEvent(application, "rejected")).length,
  };
}

function getOrderedInterviewEvents(application: Application) {
  return application.events
    .filter((event) => event.event_type === "interview")
    .sort((a, b) => {
      if (a.round_number != null && b.round_number != null) {
        const byRound = a.round_number - b.round_number;
        if (byRound !== 0) return byRound;
      }

      const byDate = a.event_date.localeCompare(b.event_date);
      if (byDate !== 0) return byDate;
      return a.created_at.localeCompare(b.created_at);
    });
}

function buildSankey(applications: Application[]) {
  const nodeCounts = new Map<string, number>([
    ["applications", applications.length],
  ]);
  const linkValues = new Map<string, FlowLink>();
  let maxInterviewRounds = 0;

  function addNodeVisit(id: string) {
    nodeCounts.set(id, (nodeCounts.get(id) ?? 0) + 1);
  }

  function addLink(source: string, target: string, color: string) {
    const id = `${source}_${target}`;
    const existing = linkValues.get(id);
    if (existing) {
      existing.value += 1;
      return;
    }

    linkValues.set(id, { id, source, target, value: 1, color });
  }

  function addTerminal(source: string, target: "offers" | "rejected") {
    addNodeVisit(target);
    if (target === "offers") {
      addLink(source, target, FLOW_COLORS.offer);
    } else {
      addLink(source, target, FLOW_COLORS.rejected);
    }
  }

  for (const application of applications) {
    const hasOa = hasEvent(application, "oa");
    const interviewEvents = getOrderedInterviewEvents(application);
    const hasOffer = hasEvent(application, "offer");
    const hasRejected = hasEvent(application, "rejected");

    maxInterviewRounds = Math.max(maxInterviewRounds, interviewEvents.length);

    let currentStage = "applications";
    let progressed = false;

    if (hasOa) {
      addNodeVisit("oa");
      addLink(currentStage, "oa", FLOW_COLORS.oa);
      currentStage = "oa";
      progressed = true;
    }

    for (let index = 0; index < interviewEvents.length; index += 1) {
      const roundId = `interview_${index + 1}`;
      addNodeVisit(roundId);
      addLink(currentStage, roundId, FLOW_COLORS.interview);
      currentStage = roundId;
      progressed = true;
    }

    if (!progressed && !hasOffer && !hasRejected) {
      addNodeVisit("no_response");
      addLink("applications", "no_response", FLOW_COLORS.pending);
      continue;
    }

    if (hasOffer) {
      addTerminal(currentStage, "offers");
      continue;
    }

    if (hasRejected) {
      addTerminal(currentStage, "rejected");
      continue;
    }

    // Active applications stay represented by the latest reached stage node.
    // Example: if 3 applications reached OA and 2 moved to Round 1, OA keeps a
    // value of 3 while only 2 units flow onward.
  }

  const terminalX = 650 + Math.max(1, maxInterviewRounds) * 170;
  const allNodes: FlowNode[] = [];

  allNodes.push({
    id: "applications",
    label: "Applications",
    count: applications.length,
    x: 64,
    cy: 348,
    color: FLOW_COLORS.applied,
  });
  allNodes.push({
    id: "no_response",
    label: "No response",
    count: nodeCounts.get("no_response") ?? 0,
    x: terminalX,
    cy: 112,
    color: FLOW_COLORS.pending,
  });
  allNodes.push({
    id: "oa",
    label: "OA",
    count: nodeCounts.get("oa") ?? 0,
    x: 286,
    cy: 348,
    color: FLOW_COLORS.oa,
  });

  for (let round = 1; round <= maxInterviewRounds; round += 1) {
    allNodes.push({
      id: `interview_${round}`,
      label: `Round ${round}`,
      count: nodeCounts.get(`interview_${round}`) ?? 0,
      x: 480 + (round - 1) * 170,
      cy: 348,
      color: FLOW_COLORS.interview,
    });
  }

  allNodes.push({
    id: "offers",
    label: "Offers",
    count: nodeCounts.get("offers") ?? 0,
    x: terminalX,
    cy: 310,
    color: FLOW_COLORS.offer,
  });
  allNodes.push({
    id: "rejected",
    label: "Rejected",
    count: nodeCounts.get("rejected") ?? 0,
    x: terminalX,
    cy: 604,
    color: FLOW_COLORS.rejected,
  });

  const links = [...linkValues.values()].filter((link) => link.value > 0);
  const nodes = allNodes.filter((node) => node.count > 0);

  return { nodes, links };
}

export function computeStats(applications: Application[]) {
  const active = applications.filter((application) => !application.archived_at);
  const archivedCount = applications.length - active.length;
  const stageCounts = buildStageCounts(active);
  const monthlyCounts = buildMonthlyCounts(active);
  const positiveSignals = active.filter(
    (application) =>
      hasEvent(application, "oa") ||
      hasEvent(application, "interview") ||
      hasEvent(application, "offer"),
  ).length;
  const daysToOa = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const oaDate = firstEventDate(application, "oa");
      return oaDate ? daysBetween(appliedDate, oaDate) : null;
    })
    .filter((value): value is number => value != null);
  const daysToInterview = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const interviewDate = firstEventDate(application, "interview");
      return interviewDate ? daysBetween(appliedDate, interviewDate) : null;
    })
    .filter((value): value is number => value != null);
  const daysToFirstProgress = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const progressDate = firstProgressDate(application);
      return progressDate ? daysBetween(appliedDate, progressDate) : null;
    })
    .filter((value): value is number => value != null);
  const daysToOffer = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const offerDate = firstEventDate(application, "offer");
      return offerDate ? daysBetween(appliedDate, offerDate) : null;
    })
    .filter((value): value is number => value != null);
  const daysToRejection = active
    .map((application) => {
      const appliedDate = applicationStartDate(application);
      const rejectionDate = firstEventDate(application, "rejected");
      return rejectionDate ? daysBetween(appliedDate, rejectionDate) : null;
    })
    .filter((value): value is number => value != null);
  const interviewRoundCounts = active
    .map((application) => getOrderedInterviewEvents(application).length)
    .filter((count) => count > 0);
  const peakMonth = monthlyCounts.reduce<MonthlyCount | null>(
    (peak, month) => (!peak || month.count > peak.count ? month : peak),
    null,
  );

  return {
    active,
    archivedCount,
    stageCounts,
    monthlyCounts,
    positiveSignals,
    noResponseCount: active.filter((application) => !hasProgress(application)).length,
    inProcessCount: active.filter((application) => hasProgress(application) && !hasTerminalDecision(application)).length,
    avgDaysToOa: average(daysToOa),
    avgDaysToInterview: average(daysToInterview),
    avgDaysToFirstProgress: average(daysToFirstProgress),
    avgDaysToOffer: average(daysToOffer),
    avgDaysToRejection: average(daysToRejection),
    avgInterviewRounds: average(interviewRoundCounts),
    maxInterviewRounds: interviewRoundCounts.length > 0 ? Math.max(...interviewRoundCounts) : 0,
    avgApplicationsPerMonth: monthlyCounts.length > 0 ? average(monthlyCounts.map((month) => month.count)) : null,
    peakMonth,
    oaSampleSize: daysToOa.length,
    interviewSampleSize: daysToInterview.length,
    firstProgressSampleSize: daysToFirstProgress.length,
    offerSampleSize: daysToOffer.length,
    rejectionSampleSize: daysToRejection.length,
    interviewRoundSampleSize: interviewRoundCounts.length,
    sankey: buildSankey(active),
  };
}
