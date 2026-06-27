import assert from "node:assert/strict";
import test from "node:test";

import {
  parseGeneralDynamicsApiAuthFromHtml,
  parseGeneralDynamicsJobDetailFields,
  parseGeneralDynamicsJobs,
} from "@/lib/scraping/adapters/general-dynamics";
import { accumulateCookieHeaders } from "@/lib/scraping/http-utils";
import type { CompanySourceConfig } from "@/lib/scraping/types";

const source: CompanySourceConfig = {
  id: "source-general-dynamics",
  companyId: "company-general-dynamics",
  companyName: "General Dynamics",
  companySlug: "general-dynamics",
  sourceType: "general_dynamics",
  adapterKey: "general-dynamics",
  sourceUrl: "https://www.gd.com/careers/job-search",
  boardToken: null,
  lastFetchedCount: null,
};

test("parseGeneralDynamicsJobDetailFields ignores slug fragments as locations", () => {
  const detail = parseGeneralDynamicsJobDetailFields(`
    <html>
      <head>
        <meta property="og:url" content="https://www.gd.com/careers/co-op-fall-2026-software-developer-8-months-cole-harbour-other-non-us-ca-744000133125725-gdms-opportunity" />
      </head>
      <body>
        <h1 class="career-detail-title featured-title">Co-op Fall 2026 - Software Developer - 8 Months</h1>
      </body>
    </html>
  `);

  assert.equal(detail.location, null);
});

test("parseGeneralDynamicsJobDetailFields rejects malformed slug detail locations", () => {
  const detail = parseGeneralDynamicsJobDetailFields(`
    <html>
      <body>
        <h1 class="career-detail-title featured-title">Co-op Fall 2026 - Software Developer - 8 Months</h1>
        <dl>
          <dt>Location</dt>
          <dd>us-ca-744000133125725-gdms-opportunity\\" /></dd>
        </dl>
      </body>
    </html>
  `);

  assert.equal(detail.location, null);
});

test("parseGeneralDynamicsJobs resolves Other / Non-US, CA as Canada", () => {
  const result = parseGeneralDynamicsJobs(
    [
      {
        title: "Co-op Fall 2026 - Software Developer - 8 Months",
        postingUrl:
          "https://www.gd.com/careers/co-op-fall-2026-software-developer-8-months-cole-harbour-other-non-us-ca-744000133125725-gdms-opportunity",
        location: "Cole Harbour, Other / Non-US, CA",
        category: "Engineering",
        companyUnit: "GDMS",
      },
    ],
    source,
    1,
  );

  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.rawLocation, "Cole Harbour, Other / Non-US, CA");
  assert.deepEqual(result.roles[0]?.countries, ["CA"]);
  assert.match(result.roles[0]?.location ?? "", /Cole Harbour/);
  assert.doesNotMatch(result.roles[0]?.location ?? "", /United States/);
});

test("parseGeneralDynamicsApiAuthFromHtml reads CareerSearch API auth attributes", () => {
  const auth = parseGeneralDynamicsApiAuthFromHtml(`
    <div data-nonce="abc123" data-signature="sig456" data-timestamp="1710000000"></div>
  `);

  assert.deepEqual(auth, {
    nonce: "abc123",
    signature: "sig456",
    timestamp: "1710000000",
  });
});

test("accumulateCookieHeaders replaces same-name cookies and preserves others", () => {
  assert.equal(
    accumulateCookieHeaders("foo=1; bar=2", ["bar=3; Path=/", "baz=4; HttpOnly"]),
    "foo=1; bar=3; baz=4",
  );
});
