import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildQstashScheduleRequest,
  getProductionQstashScheduleIds,
  getProductionQstashSchedules,
  getRetiredProductionQstashScheduleIds,
  type QstashScheduleDefinition,
} from "../../lib/cron/qstash-schedules.ts";

const SAMPLE_SCHEDULE: QstashScheduleDefinition = {
  id: "pathway-example",
  cron: "7 0,6,12,18 * * *",
  destination: "https://www.trypathway.app/api/cron/example",
  timeout: "10m",
};

describe("getProductionQstashSchedules", () => {
  it("keeps QStash production schedules disabled while GitHub Actions owns cron", () => {
    const schedules = getProductionQstashSchedules("https://www.trypathway.app/");

    assert.deepEqual(schedules, []);
    assert.deepEqual(getProductionQstashScheduleIds(), []);
  });

  it("retires the previous scrape and alert QStash schedules", () => {
    assert.deepEqual(
      getRetiredProductionQstashScheduleIds().filter((id) => id.startsWith("pathway-discover-")),
      [
        "pathway-discover-scrape-shard-0",
        "pathway-discover-scrape-shard-1",
        "pathway-discover-scrape-shard-2",
        "pathway-discover-scrape-shard-3",
      ],
    );
    assert.ok(getRetiredProductionQstashScheduleIds().includes("pathway-alerts-instant-delivery"));
    assert.ok(getRetiredProductionQstashScheduleIds().includes("pathway-alerts-daily-digest"));
  });
});

describe("buildQstashScheduleRequest", () => {
  it("builds an idempotent QStash create request with forwarded cron auth", () => {
    const request = buildQstashScheduleRequest(SAMPLE_SCHEDULE, "cron-secret");

    assert.equal(
      request.url,
      "https://qstash.upstash.io/v2/schedules/https://www.trypathway.app/api/cron/example",
    );
    assert.deepEqual(request.headers, {
      "Content-Type": "text/plain",
      "Upstash-Cron": "7 0,6,12,18 * * *",
      "Upstash-Forward-Authorization": "Bearer cron-secret",
      "Upstash-Method": "GET",
      "Upstash-Retries": "2",
      "Upstash-Schedule-Id": "pathway-example",
      "Upstash-Timeout": "10m",
    });
  });

  it("supports a regional QStash API URL", () => {
    const request = buildQstashScheduleRequest(
      SAMPLE_SCHEDULE,
      "cron-secret",
      "https://qstash-us-east-1.upstash.io/",
    );

    assert.match(request.url, /^https:\/\/qstash-us-east-1\.upstash\.io\/v2\/schedules\//);
  });
});
