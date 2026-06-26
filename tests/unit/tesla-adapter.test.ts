import assert from "node:assert/strict";
import test from "node:test";

import {
  createTeslaAdapter,
  fetchTeslaCareersState,
  TESLA_CAREERS_STATE_URL,
} from "@/lib/scraping/adapters/tesla";
import type { CompanySourceConfig } from "@/lib/scraping/types";

const source: CompanySourceConfig = {
  id: "source-tesla",
  companyId: "company-tesla",
  companyName: "Tesla",
  companySlug: "tesla",
  sourceType: "tesla",
  adapterKey: "tesla",
  sourceUrl: "https://www.tesla.com/careers/search/?query=intern&site=US",
  boardToken: "US",
  lastFetchedCount: null,
};

const teslaStatePayload = {
  lookup: {
    locations: {
      "20899": "Palo Alto, California",
    },
    departments: {
      "8": "Vehicle Software",
    },
    types: {
      "3": "Internship",
    },
  },
  listings: [
    {
      id: "260001",
      t: "Software Engineer Internship, Vehicle Software (Fall 2026)",
      dp: "8",
      l: "20899",
      y: 3,
      sp: 1,
      pu: null,
    },
  ],
};

test("Tesla adapter fetches the careers state snapshot directly", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url !== TESLA_CAREERS_STATE_URL) {
      throw new Error(`unexpected request: ${url}`);
    }
    return new Response(JSON.stringify(teslaStatePayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await createTeslaAdapter(source).fetchRoles();

    assert.deepEqual(calls, [TESLA_CAREERS_STATE_URL]);
    assert.equal(result.stats.fetched, 1);
    assert.equal(result.roles.length, 1);
    assert.equal(
      result.roles[0]?.postingUrl,
      "https://www.tesla.com/careers/search/job/software-engineer-internship-vehicle-software-fall-2026-260001",
    );
    assert.equal(result.roles[0]?.rawLocation, "Palo Alto, California");
    assert.deepEqual(result.roles[0]?.countries, ["US"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchTeslaCareersState reports blocked egress clearly", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response("<HTML><TITLE>Access Denied</TITLE></HTML>", {
      status: 403,
      headers: {
        "content-type": "text/html",
        server: "AkamaiGHost",
      },
    });

  try {
    await assert.rejects(
      () => fetchTeslaCareersState("https://www.tesla.com/careers/search/?query=intern&site=US"),
      /blocked by Tesla edge\/Akamai \(403\)/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
