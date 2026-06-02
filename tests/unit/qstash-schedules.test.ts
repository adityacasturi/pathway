import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildQstashScheduleRequest,
  getProductionQstashSchedules,
} from "../../lib/cron/qstash-schedules.ts";

describe("getProductionQstashSchedules", () => {
  it("defines four 30-minute scrape shard schedules and alert schedules", () => {
    const schedules = getProductionQstashSchedules("https://www.trypathway.app/");

    assert.deepEqual(
      schedules.map((schedule) => schedule.id),
      [
        "pathway-scrape-shard-0",
        "pathway-scrape-shard-1",
        "pathway-scrape-shard-2",
        "pathway-scrape-shard-3",
        "pathway-instant-alerts",
        "pathway-daily-digest",
      ],
    );

    assert.deepEqual(
      schedules.slice(0, 4).map((schedule) => schedule.cron),
      ["7,37 * * * *", "8,38 * * * *", "9,39 * * * *", "10,40 * * * *"],
    );
    assert.equal(
      schedules[0]?.destination,
      "https://www.trypathway.app/api/cron/scrape-postings?shard=0&shards=4&alerts=0",
    );
    assert.equal(schedules[4]?.cron, "15,45 * * * *");
    assert.equal(schedules[4]?.destination, "https://www.trypathway.app/api/cron/send-instant-alerts");
    assert.equal(schedules[5]?.cron, "11 14 * * *");
    assert.equal(schedules[5]?.destination, "https://www.trypathway.app/api/cron/send-alert-digests");
  });
});

describe("buildQstashScheduleRequest", () => {
  it("builds an idempotent QStash create request with forwarded cron auth", () => {
    const [schedule] = getProductionQstashSchedules("https://www.trypathway.app");
    assert.ok(schedule);

    const request = buildQstashScheduleRequest(schedule, "cron-secret");

    assert.equal(
      request.url,
      "https://qstash.upstash.io/v2/schedules/https://www.trypathway.app/api/cron/scrape-postings?shard=0&shards=4&alerts=0",
    );
    assert.deepEqual(request.headers, {
      "Content-Type": "text/plain",
      "Upstash-Cron": "7,37 * * * *",
      "Upstash-Forward-Authorization": "Bearer cron-secret",
      "Upstash-Method": "GET",
      "Upstash-Retries": "2",
      "Upstash-Schedule-Id": "pathway-scrape-shard-0",
      "Upstash-Timeout": "10m",
    });
  });

  it("supports a regional QStash API URL", () => {
    const [schedule] = getProductionQstashSchedules("https://www.trypathway.app");
    assert.ok(schedule);

    const request = buildQstashScheduleRequest(
      schedule,
      "cron-secret",
      "https://qstash-us-east-1.upstash.io/",
    );

    assert.match(request.url, /^https:\/\/qstash-us-east-1\.upstash\.io\/v2\/schedules\//);
  });
});
