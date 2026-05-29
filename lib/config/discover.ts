const MS_PER_SECOND = 1000;

const MAX_DISCOVER_HISTORY_MONTHS = 2;

export interface DiscoverCutoff {
  cutoffDate: string;
  cutoffUnix: number;
  oldestAllowedDate: string;
  today: string;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractUtcMonths(date: Date, months: number): Date {
  const out = new Date(date);
  const targetDay = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() - months);
  const daysInTargetMonth = new Date(
    Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0),
  ).getUTCDate();
  out.setUTCDate(Math.min(targetDay, daysInTargetMonth));
  return out;
}

function parseIsoDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return toIsoDate(parsed) === raw ? parsed : null;
}

function getDiscoverCutoffBounds(now = new Date()) {
  const todayDate = startOfUtcDay(now);
  const oldestDate = subtractUtcMonths(todayDate, MAX_DISCOVER_HISTORY_MONTHS);

  return {
    oldestAllowedDate: toIsoDate(oldestDate),
    today: toIsoDate(todayDate),
  };
}

/** Most recent March 31 on or before today (recruiting-season default). */
export function getDefaultDiscoverCutoffDate(now = new Date()): string {
  const todayDate = startOfUtcDay(now);
  const year = todayDate.getUTCFullYear();
  const mar31ThisYear = parseIsoDate(`${year}-03-31`);
  if (mar31ThisYear && todayDate >= mar31ThisYear) {
    return toIsoDate(mar31ThisYear);
  }
  const mar31PriorYear = parseIsoDate(`${year - 1}-03-31`);
  return mar31PriorYear ? toIsoDate(mar31PriorYear) : toIsoDate(todayDate);
}

export function resolveDiscoverCutoffDate(raw?: string | null, now = new Date()): DiscoverCutoff {
  const bounds = getDiscoverCutoffBounds(now);
  const requestedDate = raw ? parseIsoDate(raw) : null;
  const oldestDate = parseIsoDate(bounds.oldestAllowedDate) as Date;
  const todayDate = parseIsoDate(bounds.today) as Date;
  const defaultDate = parseIsoDate(getDefaultDiscoverCutoffDate(now)) as Date;

  let cutoffDate = requestedDate ?? defaultDate;
  if (cutoffDate < oldestDate) cutoffDate = oldestDate;
  if (cutoffDate > todayDate) cutoffDate = todayDate;

  return {
    cutoffDate: toIsoDate(cutoffDate),
    cutoffUnix: Math.floor(cutoffDate.getTime() / MS_PER_SECOND),
    oldestAllowedDate: bounds.oldestAllowedDate,
    today: bounds.today,
  };
}

export function isValidDiscoverCutoffDate(raw: unknown): raw is string {
  return typeof raw === "string" && parseIsoDate(raw) !== null;
}
