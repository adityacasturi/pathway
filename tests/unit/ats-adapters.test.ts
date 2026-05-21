import assert from "node:assert/strict";
import test from "node:test";
import { createGreenhouseAdapter, parseGreenhouseJobs } from "../../lib/scraping/adapters/greenhouse.ts";
import { createLeverAdapter, parseLeverJobs } from "../../lib/scraping/adapters/lever.ts";
import { createAshbyAdapter, parseAshbyJobs } from "../../lib/scraping/adapters/ashby.ts";
import { parseAmazonJobs } from "../../lib/scraping/adapters/amazon.ts";
import { parseNvidiaPositions } from "../../lib/scraping/adapters/nvidia.ts";
import type { ScrapeSourceConfig } from "../../lib/scraping/types.ts";

const MOCK_SOURCE: ScrapeSourceConfig = {
  companySlug: "acme",
  companyName: "Acme Corp",
  sourceType: "custom",
  adapterKey: "acme-custom",
  sourceUrl: "https://example.com/careers",
};

test("parseGreenhouseJobs normalizes matching Greenhouse jobs", () => {
  const jobs = [
    {
      id: 12345,
      title: "Software Engineer Intern (Summer 2027)",
      absolute_url: "https://boards.greenhouse.io/acme/jobs/12345",
      updated_at: "2026-05-20T10:00:00Z",
      location: { name: "New York, NY" },
      content: "Join us for a Summer 2027 internship in NYC.",
    },
    {
      id: 67890,
      title: "Senior Product Manager",
      absolute_url: "https://boards.greenhouse.io/acme/jobs/67890",
      updated_at: "2026-05-20T11:00:00Z",
      location: { name: "San Francisco, CA" },
      content: "Experienced product leader wanted.",
    },
  ];

  const postings = parseGreenhouseJobs(jobs, MOCK_SOURCE);

  assert.equal(postings.length, 1);
  const p = postings[0];
  assert.equal(p.companySlug, "acme");
  assert.equal(p.companyName, "Acme Corp");
  assert.equal(p.roleName, "Software Engineer Intern");
  assert.equal(p.roleNameRaw, "Software Engineer Intern (Summer 2027)");
  assert.equal(p.postingUrl, "https://boards.greenhouse.io/acme/jobs/12345");
  assert.equal(p.canonicalUrl, "https://boards.greenhouse.io/acme/jobs/12345");
  assert.equal(p.externalJobId, "12345");
  assert.equal(p.datePosted, "2026-05-20T10:00:00.000Z");
  assert.deepEqual(p.locations, ["New York, NY"]);
  assert.deepEqual(p.countries, ["US"]);
  assert.equal(p.season, "Summer");
  assert.equal(p.seasonYear, 2027);
});

test("parseGreenhouseJobs tolerates invalid dates and de-duplicates canonical URLs", () => {
  const jobs = [
    {
      id: 1,
      title: "Software Engineer Intern",
      absolute_url: "https://boards.greenhouse.io/acme/jobs/1?utm_source=foo",
      updated_at: "invalid-date",
      location: { name: "Remote in US" },
    },
    {
      id: 1,
      title: "Software Engineer Intern",
      absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
      location: { name: "Remote in US" },
    },
  ];

  const postings = parseGreenhouseJobs(jobs, MOCK_SOURCE);
  assert.equal(postings.length, 1);
  assert.equal(postings[0].datePosted, null);
  assert.equal(postings[0].datePostedSource, "unknown");
});

test("parseLeverJobs normalizes matching Lever jobs", () => {
  const jobs = [
    {
      id: "abc-123",
      text: "Data Science Co-op",
      hostedUrl: "https://jobs.lever.co/acme/abc-123",
      createdAt: 1787265432000,
      categories: {
        location: "San Francisco, CA",
        allLocations: ["San Francisco, CA"],
        commitment: "Internship",
      },
      description: "Looking for an early career data scientist.",
    },
    {
      id: "def-456",
      text: "General Counsel",
      hostedUrl: "https://jobs.lever.co/acme/def-456",
      createdAt: 1787265432000,
      categories: {
        location: "Remote",
        commitment: "Full-time",
      },
      description: "Lead our legal team.",
    },
  ];

  const postings = parseLeverJobs(jobs, MOCK_SOURCE);

  assert.equal(postings.length, 1);
  const p = postings[0];
  assert.equal(p.companySlug, "acme");
  assert.equal(p.roleName, "Data Science Co-op");
  assert.equal(p.postingUrl, "https://jobs.lever.co/acme/abc-123");
  assert.equal(p.externalJobId, "abc-123");
  assert.equal(p.datePosted, new Date(1787265432000).toISOString());
  assert.deepEqual(p.locations, ["San Francisco, CA"]);
  assert.deepEqual(p.countries, ["US"]);
});

test("parseLeverJobs tolerates invalid createdAt values and de-duplicates canonical URLs", () => {
  const jobs = [
    {
      id: "abc-123",
      text: "Data Science Co-op",
      hostedUrl: "https://jobs.lever.co/acme/abc-123?lever-source=linkedin",
      createdAt: Number.NaN,
      categories: {
        location: "San Francisco, CA",
      },
    },
    {
      id: "abc-123",
      text: "Data Science Co-op",
      hostedUrl: "https://jobs.lever.co/acme/abc-123",
      createdAt: Number.NaN,
      categories: {
        location: "San Francisco, CA",
      },
    },
  ];

  const postings = parseLeverJobs(jobs, MOCK_SOURCE);
  assert.equal(postings.length, 1);
  assert.equal(postings[0].datePosted, null);
  assert.equal(postings[0].datePostedSource, "unknown");
});

test("parseAshbyJobs normalizes matching Ashby jobs", () => {
  const jobs = [
    {
      id: "ash-789",
      title: "Frontend Engineer Intern",
      jobUrl: "https://jobs.ashbyhq.com/acme/ash-789",
      publishedAt: "2026-05-21T01:00:00Z",
      employmentType: "Intern",
      location: "New York, NY",
      descriptionHtml: "<p>Work on our React UI.</p>",
    },
    {
      id: "ash-999",
      title: "VP of Engineering",
      jobUrl: "https://jobs.ashbyhq.com/acme/ash-999",
      publishedAt: "2026-05-21T01:00:00Z",
      employmentType: "FullTime",
      location: "Remote",
    },
  ];

  const postings = parseAshbyJobs(jobs, MOCK_SOURCE);

  assert.equal(postings.length, 1);
  const p = postings[0];
  assert.equal(p.companySlug, "acme");
  assert.equal(p.roleName, "Frontend Engineer Intern");
  assert.equal(p.postingUrl, "https://jobs.ashbyhq.com/acme/ash-789");
  assert.equal(p.externalJobId, "ash-789");
  assert.equal(p.datePosted, "2026-05-21T01:00:00.000Z");
  assert.deepEqual(p.locations, ["New York, NY"]);
  assert.deepEqual(p.countries, ["US"]);
});

test("parseAshbyJobs excludes internships outside the United States", () => {
  const jobs = [
    {
      id: "ash-intl",
      title: "Software Engineer Intern",
      jobUrl: "https://jobs.ashbyhq.com/acme/ash-intl",
      employmentType: "Internship",
      location: "Toronto, Canada",
      description: "Build backend services.",
    },
  ];

  const postings = parseAshbyJobs(jobs, MOCK_SOURCE);
  assert.equal(postings.length, 0);
});

test("parseAshbyJobs falls back to board token URL and tolerates invalid published dates", () => {
  const source: ScrapeSourceConfig = {
    ...MOCK_SOURCE,
    boardToken: "ashby-board",
  };
  const jobs = [
    {
      id: "ash-111",
      title: "Product Engineer Intern",
      employmentType: "Intern",
      publishedAt: "not-a-date",
      location: "Remote in US",
    },
  ];

  const postings = parseAshbyJobs(jobs, source);
  assert.equal(postings.length, 1);
  assert.equal(postings[0].postingUrl, "https://jobs.ashbyhq.com/ashby-board/ash-111");
  assert.equal(postings[0].datePosted, null);
  assert.equal(postings[0].datePostedSource, "unknown");
});

test("ATS parsers reject non-engineering internships", () => {
  assert.equal(
    parseGreenhouseJobs(
      [
        {
          id: 1,
          title: "Field Sales Intern",
          absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
        },
      ],
      MOCK_SOURCE,
    ).length,
    0,
  );
  assert.equal(
    parseLeverJobs(
      [
        {
          id: "abc-123",
          text: "Communications Intern",
          hostedUrl: "https://jobs.lever.co/acme/abc-123",
        },
      ],
      MOCK_SOURCE,
    ).length,
    0,
  );
  assert.equal(
    parseAshbyJobs(
      [
        {
          id: "ash-333",
          title: "Legal Intern",
          employmentType: "Intern",
          jobUrl: "https://jobs.ashbyhq.com/acme/ash-333",
        },
      ],
      MOCK_SOURCE,
    ).length,
    0,
  );
});

test("parseAshbyJobs accepts internship employment type when title omits intern wording", () => {
  const jobs = [
    {
      id: "ash-222",
      title: "Machine Learning Engineer",
      employmentType: "Internship",
      jobUrl: "https://jobs.ashbyhq.com/acme/ash-222",
      location: "Remote in US",
    },
  ];

  const postings = parseAshbyJobs(jobs, MOCK_SOURCE);
  assert.equal(postings.length, 1);
  assert.equal(postings[0].roleName, "Machine Learning Engineer");
});

test("createGreenhouseAdapter derives board token from source URL", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assert.match(url, /\/boards\/stripe\/jobs\?content=true$/);
    return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
  };

  try {
    const adapter = createGreenhouseAdapter({
      ...MOCK_SOURCE,
      sourceType: "greenhouse",
      adapterKey: "stripe-greenhouse",
      companySlug: "stripe-inc",
      sourceUrl: "https://boards.greenhouse.io/stripe",
    });
    await adapter.fetchPostings();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createAshbyAdapter derives board token from source URL", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assert.match(url, /\/job-board\/notion$/);
    return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
  };

  try {
    const adapter = createAshbyAdapter({
      ...MOCK_SOURCE,
      sourceType: "ashby",
      adapterKey: "notion-ashby",
      companySlug: "notion-labs",
      sourceUrl: "https://jobs.ashbyhq.com/notion",
    });
    await adapter.fetchPostings();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const NVIDIA_SOURCE: ScrapeSourceConfig = {
  companySlug: "nvidia",
  companyName: "NVIDIA",
  sourceType: "custom",
  adapterKey: "nvidia-eightfold",
  sourceUrl: "https://jobs.nvidia.com",
};

const AMAZON_SOURCE: ScrapeSourceConfig = {
  companySlug: "amazon",
  companyName: "Amazon",
  sourceType: "custom",
  adapterKey: "amazon-jobs",
  sourceUrl: "https://www.amazon.jobs",
};

test("parseAmazonJobs normalizes US engineering internships", () => {
  const jobs = [
    {
      id: "10412530",
      title: "Software Development Engineer Intern, AWS Data Services - Fall 2026 (US)",
      job_path: "/en/jobs/10412530/software-development-engineer-intern-aws-data-services-fall-2026-us",
      city: "Seattle",
      state: "WA",
      country_code: "USA",
      posted_date: "May  6, 2026",
      description_short: "Join us for a Fall 2026 internship in software development.",
      locations: [
        '{"normalizedLocation":"Seattle, Washington, USA","location":"US, WA, Seattle","normalizedCountryCode":"USA"}',
      ],
    },
    {
      id: "99999",
      title: "Senior Product Manager",
      job_path: "/en/jobs/99999/senior-product-manager",
      city: "Seattle",
      state: "WA",
      country_code: "USA",
      posted_date: "May  6, 2026",
    },
    {
      id: "88888",
      title: "Software Development Engineer Internship - Summer 2026 (Canada)",
      job_path: "/en/jobs/88888/software-development-engineer-internship-summer-2026-canada",
      city: "Vancouver",
      state: "BC",
      country_code: "CAN",
      posted_date: "May  6, 2026",
    },
  ];

  const postings = parseAmazonJobs(jobs, AMAZON_SOURCE);

  assert.equal(postings.length, 1);
  const posting = postings[0];
  assert.equal(posting.companySlug, "amazon");
  assert.equal(
    posting.roleName,
    "Software Development Engineer Intern, AWS Data Services - Fall 2026 (US)",
  );
  assert.equal(
    posting.postingUrl,
    "https://www.amazon.jobs/en/jobs/10412530/software-development-engineer-intern-aws-data-services-fall-2026-us",
  );
  assert.equal(posting.externalJobId, "10412530");
  assert.deepEqual(posting.locations, ["Seattle, Washington, USA"]);
  assert.deepEqual(posting.countries, ["US"]);
  assert.equal(posting.season, "Fall");
  assert.equal(posting.seasonYear, 2026);
  assert.equal(posting.datePostedSource, "ats");
});

test("parseNvidiaPositions normalizes US engineering internships", () => {
  const positions = [
    {
      id: 893395231207,
      displayJobId: "JR2018617",
      name: "Software Engineering Intern, AI Tools - Fall 2026",
      locations: ["US, CA, Santa Clara"],
      postedTs: 1779321600,
      department: "Engineer, Sys SW",
      positionUrl: "/careers/job/893395231207",
    },
    {
      id: 893382671528,
      displayJobId: "JR1998048",
      name: "Senior DGX Cloud AI Infrastructure Software Engineer",
      locations: ["US, CA, Santa Clara"],
      postedTs: 1779321600,
      department: "Engineer, Sys SW",
      positionUrl: "/careers/job/893382671528",
    },
    {
      id: 893392160910,
      displayJobId: "JR2007807",
      name: "Software Engineering Intern, JAX - Fall 2026",
      locations: ["China, Shanghai"],
      postedTs: 1779321600,
      department: "Engineer, Sys SW",
      positionUrl: "/careers/job/893392160910",
    },
    {
      id: 893392160911,
      displayJobId: "JR2007808",
      name: "Technical Marketing Engineering Intern, Robotics - Fall 2026",
      locations: ["US, CA, Santa Clara"],
      postedTs: 1779321600,
      department: "Marketing",
      positionUrl: "/careers/job/893392160911",
    },
  ];

  const postings = parseNvidiaPositions(positions, NVIDIA_SOURCE);

  assert.equal(postings.length, 1);
  const posting = postings[0];
  assert.equal(posting.companySlug, "nvidia");
  assert.equal(posting.roleName, "Software Engineering Intern, AI Tools");
  assert.equal(posting.roleNameRaw, "Software Engineering Intern, AI Tools - Fall 2026");
  assert.equal(posting.postingUrl, "https://jobs.nvidia.com/careers/job/893395231207");
  assert.equal(posting.externalJobId, "JR2018617");
  assert.deepEqual(posting.locations, ["US, CA, Santa Clara"]);
  assert.deepEqual(posting.countries, ["US"]);
  assert.equal(posting.season, "Fall");
  assert.equal(posting.seasonYear, 2026);
  assert.equal(posting.datePostedSource, "ats");
});

test("createLeverAdapter derives board token from source URL", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assert.match(url, /\/postings\/vercel\?mode=json$/);
    return new Response(JSON.stringify([]), { status: 200 });
  };

  try {
    const adapter = createLeverAdapter({
      ...MOCK_SOURCE,
      sourceType: "lever",
      adapterKey: "vercel-lever",
      companySlug: "vercel-inc",
      sourceUrl: "https://jobs.lever.co/vercel",
    });
    await adapter.fetchPostings();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
