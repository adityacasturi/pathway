import { Application, ApplicationEvent } from "@/types/application";

const PROGRESS_EVENT_TYPES = new Set(["interview", "offer", "rejected"]);
const DEADLINE_URGENCY_DAYS = 3;

type OaDeadlineStatus = "overdue" | "urgent" | "upcoming" | "completed";

export interface OaDeadlineState {
  event: ApplicationEvent;
  deadlineDate: string;
  daysUntilDue: number;
  status: OaDeadlineStatus;
  active: boolean;
  completionReason: "manual" | "progressed" | null;
}

function localTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOnlyToUtcMs(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysUntilDate(deadlineDate: string, today: string = localTodayISO()): number {
  return Math.round((dateOnlyToUtcMs(deadlineDate) - dateOnlyToUtcMs(today)) / 86_400_000);
}

function isProgressAfter(oaEvent: ApplicationEvent, event: ApplicationEvent): boolean {
  if (!PROGRESS_EVENT_TYPES.has(event.event_type)) return false;
  if (event.event_date > oaEvent.event_date) return true;
  if (event.event_date < oaEvent.event_date) return false;
  return event.created_at > oaEvent.created_at;
}

export function getOaDeadlineState(
  application: Pick<Application, "events">,
  event: ApplicationEvent,
  today?: string,
): OaDeadlineState | null {
  if (event.event_type !== "oa" || !event.deadline_date) return null;

  const progressed = application.events.some((candidate) => isProgressAfter(event, candidate));
  const manuallyCompleted = Boolean(event.deadline_completed_at);
  const active = !manuallyCompleted && !progressed;
  const daysUntilDue = daysUntilDate(event.deadline_date, today);

  let status: OaDeadlineStatus = "upcoming";
  if (!active) status = "completed";
  else if (daysUntilDue < 0) status = "overdue";
  else if (daysUntilDue <= DEADLINE_URGENCY_DAYS) status = "urgent";

  return {
    event,
    deadlineDate: event.deadline_date,
    daysUntilDue,
    status,
    active,
    completionReason: manuallyCompleted ? "manual" : progressed ? "progressed" : null,
  };
}

function getOaDeadlineStates(
  application: Pick<Application, "events">,
  today?: string,
): OaDeadlineState[] {
  return application.events
    .map((event) => getOaDeadlineState(application, event, today))
    .filter((state): state is OaDeadlineState => state !== null);
}

export function getActiveOaDeadlines(
  application: Pick<Application, "events">,
  today?: string,
): OaDeadlineState[] {
  return getOaDeadlineStates(application, today)
    .filter((state) => state.active)
    .sort(compareOaDeadlineStates);
}

export function getNextActiveOaDeadline(
  application: Pick<Application, "events">,
  today?: string,
): OaDeadlineState | null {
  return getActiveOaDeadlines(application, today)[0] ?? null;
}

export function compareOaDeadlineStates(a: OaDeadlineState, b: OaDeadlineState): number {
  if (a.status === "overdue" && b.status !== "overdue") return -1;
  if (a.status !== "overdue" && b.status === "overdue") return 1;
  const byDate = a.deadlineDate.localeCompare(b.deadlineDate);
  if (byDate !== 0) return byDate;
  return a.event.created_at.localeCompare(b.event.created_at);
}

export function deadlineStatusLabel(state: Pick<OaDeadlineState, "daysUntilDue" | "status">): string {
  if (state.status === "completed") return "Completed";
  if (state.daysUntilDue < 0) {
    const days = Math.abs(state.daysUntilDue);
    return `${days}d overdue`;
  }
  if (state.daysUntilDue === 0) return "Due today";
  if (state.daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${state.daysUntilDue}d`;
}
