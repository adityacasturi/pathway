#!/usr/bin/env node
import {
  buildQstashScheduleRequest,
  getProductionQstashScheduleIds,
  getProductionQstashSchedules,
  getQstashSchedulesUrl,
  normalizeQstashSchedulesUrl,
  type QstashScheduleDefinition,
} from "../lib/cron/qstash-schedules.ts";
import { loadDotEnvLocal } from "./discover-queue/env.ts";

type Command = "list" | "upsert" | "delete";

interface QstashScheduleListItem {
  scheduleId: string;
  cron?: string;
  destination?: string;
  isPaused?: boolean;
  nextScheduleTime?: number;
}

async function main() {
  loadDotEnvLocal();

  const command = parseCommand(process.argv[2]);
  const token = readRequiredEnv("QSTASH_TOKEN");
  const qstashSchedulesUrl = resolveQstashSchedulesUrl();

  if (command === "list") {
    const schedules = await listSchedules(token, qstashSchedulesUrl);
    printSchedules(schedules);
    return;
  }

  if (command === "delete") {
    await deleteSchedules(token, qstashSchedulesUrl);
    return;
  }

  const baseUrl = readRequiredEnv("CRON_BASE_URL");
  const cronSecret = readRequiredEnv("CRON_SECRET");
  await upsertSchedules(token, baseUrl, cronSecret, qstashSchedulesUrl);
}

async function upsertSchedules(
  token: string,
  baseUrl: string,
  cronSecret: string,
  qstashSchedulesUrl: string,
) {
  const schedules = getProductionQstashSchedules(baseUrl);
  for (const schedule of schedules) {
    const request = buildQstashScheduleRequest(schedule, cronSecret, qstashSchedulesUrl);
    const response = await fetch(request.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...request.headers,
      },
      body: "",
    });
    await assertOk(response, `upsert ${schedule.id}`);
    console.log(formatScheduleLine("upserted", schedule));
  }
}

async function deleteSchedules(token: string, qstashSchedulesUrl: string) {
  for (const scheduleId of getProductionQstashScheduleIds()) {
    const response = await fetch(`${qstashSchedulesUrl}/${encodeURIComponent(scheduleId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) {
      console.log(`missing ${scheduleId}`);
      continue;
    }
    await assertOk(response, `delete ${scheduleId}`);
    console.log(`deleted ${scheduleId}`);
  }
}

async function listSchedules(token: string, qstashSchedulesUrl: string): Promise<QstashScheduleListItem[]> {
  const response = await fetch(qstashSchedulesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(response, "list schedules");
  const schedules = (await response.json()) as QstashScheduleListItem[];
  const scheduleIds = new Set(getProductionQstashScheduleIds());
  return schedules.filter((schedule) => scheduleIds.has(schedule.scheduleId));
}

function printSchedules(schedules: QstashScheduleListItem[]) {
  if (schedules.length === 0) {
    console.log("No Pathway QStash schedules found.");
    return;
  }

  for (const schedule of schedules) {
    const next = schedule.nextScheduleTime
      ? new Date(schedule.nextScheduleTime).toISOString()
      : "unknown";
    console.log(
      [
        schedule.scheduleId,
        `cron=${schedule.cron ?? "unknown"}`,
        `paused=${String(schedule.isPaused ?? false)}`,
        `next=${next}`,
        `destination=${schedule.destination ?? "unknown"}`,
      ].join(" "),
    );
  }
}

function formatScheduleLine(action: string, schedule: QstashScheduleDefinition): string {
  return `${action} ${schedule.id} cron="${schedule.cron}" destination=${schedule.destination}`;
}

async function assertOk(response: Response, action: string) {
  if (response.ok) {
    return;
  }
  const body = await response.text();
  throw new Error(`${action} failed: ${response.status} ${response.statusText}${body ? ` ${body}` : ""}`);
}

function parseCommand(value: string | undefined): Command {
  if (value === "list" || value === "upsert" || value === "delete") {
    return value;
  }
  console.error("Usage: npm run qstash:cron -- <list|upsert|delete>");
  process.exit(1);
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function resolveQstashSchedulesUrl(): string {
  return normalizeQstashSchedulesUrl(process.env.QSTASH_URL ?? getQstashSchedulesUrl());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
