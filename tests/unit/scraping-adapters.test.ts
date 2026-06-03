import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  isPublishSource,
  scrapedRolePublishedIso,
  sitemapLastmodPublishDate,
} from "../../lib/scraping/posted-date.ts";
import { lockheedRoleDates } from "../../lib/scraping/adapters/lockheed-martin.ts";
import { atlassianListingDates } from "../../lib/scraping/adapters/atlassian.ts";
import {
  collectAshbyLocations,
  formatAshbyLocation,
  normalizeAshbyEmploymentType,
  parseAshbyJobs,
} from "../../lib/scraping/adapters/ashby.ts";
import { formatUsAtsPostalAddress } from "../../lib/scraping/ats-postal-address.ts";
import {
  parseGreenhouseEmploymentMetadata,
  parseGreenhouseJobs,
} from "../../lib/scraping/adapters/greenhouse.ts";
import {
  inferJaneStreetSeason,
  parseJaneStreetEmploymentMetadata,
  parseJaneStreetJobs,
} from "../../lib/scraping/adapters/jane-street.ts";
import { parseLeverJobs } from "../../lib/scraping/adapters/lever.ts";
import {
  isHiringThingListCandidate,
  parseHiringThingJobDetailHtml,
  parseHiringThingListHtml,
} from "../../lib/scraping/adapters/hiringthing.ts";
import {
  parsePinpointJobs,
  resolvePinpointBoard,
} from "../../lib/scraping/adapters/pinpoint.ts";
import {
  isJobviteListCandidate,
  parseJobviteListHtml,
  resolveJobviteBoard,
} from "../../lib/scraping/adapters/jobvite.ts";
import {
  buildSeagateSearchUrl,
  isSeagateListCandidate,
  parseSeagateSearchHtml,
  parseSeagateJobDetailHtml,
  resolveSeagateBoard,
} from "../../lib/scraping/adapters/seagate.ts";
import {
  extractLumaGemJobsFromCareersHtml,
  parseLumaAiJobs,
} from "../../lib/scraping/adapters/luma-ai.ts";
import { parseModularJobs } from "../../lib/scraping/adapters/modular.ts";
import {
  parseSakanaAiCareersHtml,
  shouldSkipSakanaHeadingId,
} from "../../lib/scraping/adapters/sakana-ai.ts";
import { isReplicateGreenhouseJob } from "../../lib/scraping/adapters/replicate.ts";
import { isXCorpGreenhouseJob } from "../../lib/scraping/adapters/x-corp.ts";
import { isWeightsBiasesGreenhouseJob } from "../../lib/scraping/adapters/weights-biases.ts";
import {
  formatOneXRecruiteeLocation,
  parseOneXRecruiteeJobs,
} from "../../lib/scraping/adapters/one-x-technologies.ts";
import { isSurgeListCandidate, parseSurgeIndexHtml } from "../../lib/scraping/adapters/surge.ts";
import {
  isSmartRecruitersListInternCandidate,
  parseSmartRecruitersJobs,
} from "../../lib/scraping/adapters/smartrecruiters.ts";
import { parseBreezyJobs } from "../../lib/scraping/adapters/breezy.ts";
import { parseWorkableJobs } from "../../lib/scraping/adapters/workable.ts";
import {
  HRT_GREENHOUSE_CAREERS_URL,
  HRT_GREENHOUSE_BOARD_TOKEN,
  resolveHrtGreenhouseSource,
} from "../../lib/scraping/adapters/hudson-river-trading.ts";
import {
  TOWER_RESEARCH_CAREERS_URL,
  TOWER_RESEARCH_GREENHOUSE_BOARD_TOKEN,
  resolveTowerResearchGreenhouseSource,
} from "../../lib/scraping/adapters/tower-research.ts";
import {
  FIVE_RINGS_CAREERS_URL,
  FIVE_RINGS_GREENHOUSE_BOARD_TOKEN,
  resolveFiveRingsGreenhouseSource,
} from "../../lib/scraping/adapters/five-rings.ts";
import {
  CITADEL_BRAND_ORIGINS,
  humanizeCitadelSlug,
  inferCitadelLocations,
  parseCitadelSitemapEntries,
  parseCitadelSitemapXml,
  resolveCitadelBoard,
  slugFromPostingUrl,
} from "../../lib/scraping/adapters/citadel.ts";
import {
  DE_SHAW_INTERNSHIPS_URL,
  collectDeShawListings,
  indexDeShawCareerPaths,
  parseDeShawJobs,
  parseDeShawNextDataHtml,
  resolveDeShawBoard,
} from "../../lib/scraping/adapters/de-shaw.ts";
import {
  NVIDIA_WORKDAY_CAREERS_URL,
  resolveNvidiaWorkdaySource,
} from "../../lib/scraping/adapters/nvidia.ts";
import {
  RTX_WORKDAY_CAREERS_URL,
  resolveRtxWorkdaySource,
} from "../../lib/scraping/adapters/rtx.ts";
import {
  EA_SEARCH_JOBS_URL,
  mergeElectronicArtsRssDates,
  parseElectronicArtsJobDetailFields,
  parseElectronicArtsJobs,
  parseElectronicArtsRssFeed,
  resolveElectronicArtsBoard,
  shouldPrefetchElectronicArtsDetail,
} from "../../lib/scraping/adapters/electronic-arts.ts";
import {
  BLOOMBERG_SEARCH_JOBS_URL,
  parseBloombergJobDetailFields,
  parseBloombergJobs,
  parseBloombergSearchJobsHtml,
  resolveBloombergBoard,
  shouldPrefetchBloombergDetail,
} from "../../lib/scraping/adapters/bloomberg.ts";
import {
  IBM_SEARCH_JOBS_URL,
  buildIbmPostingUrl,
  parseIbmJobDetailFields,
  parseIbmJobs,
  parseIbmSearchJobsHtml,
  resolveIbmBoard,
  shouldPrefetchIbmDetail,
} from "../../lib/scraping/adapters/ibm.ts";
import {
  COINBASE_DEFAULT_BOARD_TOKEN,
  COINBASE_DEFAULT_POSITIONS_URL,
  buildCoinbasePostingUrl,
  flattenCoinbaseJobs,
  mergeCoinbaseDepartmentsWithMetadata,
  parseCoinbaseCareersResponse,
  parseCoinbaseJobs,
  resolveCoinbaseBoard,
} from "../../lib/scraping/adapters/coinbase.ts";
import {
  LOCKHEED_MARTIN_CAREERS_URL,
  buildLockheedMartinPostingUrl,
  isLockheedListCandidate,
  parseBrassRingJobDetailResponse,
  parseBrassRingMatchedJobsResponse,
  parseLockheedMartinJobs,
  resolveLockheedMartinBoard,
} from "../../lib/scraping/adapters/lockheed-martin.ts";
import {
  TWO_SIGMA_OPEN_ROLES_URL,
  parseTwoSigmaJobs,
  parseTwoSigmaJobDetailFields,
  parseTwoSigmaOpenRolesHtml,
  resolveTwoSigmaBoard,
  shouldPrefetchTwoSigmaDetail,
} from "../../lib/scraping/adapters/two-sigma.ts";
import {
  buildMicrosoftPostingUrl,
  parseMicrosoftPostings,
  resolveMicrosoftBoard,
} from "../../lib/scraping/adapters/microsoft.ts";
import {
  QUALCOMM_CAREERS_ORIGIN,
  isQualcommCareersUrl,
  resolveQualcommSource,
} from "../../lib/scraping/adapters/qualcomm.ts";
import {
  MORGAN_STANLEY_CAREERS_ORIGIN,
  isMorganStanleyCareersUrl,
  resolveMorganStanleySource,
} from "../../lib/scraping/adapters/morgan-stanley.ts";
import {
  AMD_DEFAULT_CATEGORY,
  AMD_JOBS_API_URL,
  buildAmdPostingUrl,
  parseAmdJobs,
  resolveAmdBoard,
} from "../../lib/scraping/adapters/amd.ts";
import {
  SIG_DEFAULT_CATEGORY,
  SIG_JOBS_API_URL,
  buildSigPostingUrl,
  parseSigJobs,
  resolveSigBoard,
} from "../../lib/scraping/adapters/sig.ts";
import {
  RIVIAN_DEFAULT_CATEGORY,
  RIVIAN_JOBS_API_URL,
  buildRivianPostingUrl,
  parseRivianJobs,
  resolveRivianBoard,
} from "../../lib/scraping/adapters/rivian.ts";
import {
  GITHUB_DEFAULT_BOARD_TOKEN,
  GITHUB_JOBS_API_URL,
  buildGithubPostingUrl,
  parseGithubJobs,
  resolveGithubBoard,
} from "../../lib/scraping/adapters/github.ts";
import {
  SPLUNK_CISCO_BOARD_TOKEN,
  SPLUNK_CISCO_CAREERS_URL,
} from "../../lib/scraping/adapters/splunk.ts";
import { isSlackRelatedJob } from "../../lib/scraping/adapters/slack.ts";
import {
  SAP_US_INTERN_CATEGORY_ID,
  SAP_US_INTERN_RSS_URL,
  extractSapLocationFromTitle,
  isSapListCandidate,
  normalizeSapPostingUrl,
  parseSapJobs,
  parseSapRssXml,
  resolveSapBoard,
} from "../../lib/scraping/adapters/sap.ts";
import {
  TERADATA_DEFAULT_CAREERS_URL,
  TERADATA_GRAPHQL_URL,
  buildTeradataPostingUrl,
  isTeradataListCandidate,
  parseTeradataJobs,
  parseTeradataSearchResponse,
  resolveTeradataBoard,
} from "../../lib/scraping/adapters/teradata.ts";
import {
  CHEWY_DEFAULT_CAREERS_URL,
  CHEWY_DEFAULT_REF_NUM,
  buildChewyPostingUrl,
  isChewyListCandidate,
  parseChewyJobs,
  parseChewyRefineSearchResponse,
  resolveChewyBoard,
} from "../../lib/scraping/adapters/chewy.ts";
import {
  PEAK6_CAREERS_URL,
  PEAK6_DEFAULT_GROUP_ID,
  PEAK6_JOBS_ORIGIN,
  buildPeak6PostingUrl,
  isPeak6ListCandidate,
  parsePeak6Jobs,
  resolvePeak6Board,
} from "../../lib/scraping/adapters/peak6.ts";
import {
  buildGooglePostingUrl,
  googleJobLocations,
  parseGoogleJobs,
  resolveGoogleSearchUrl,
} from "../../lib/scraping/adapters/google.ts";
import {
  buildApplePostingUrl,
  buildAppleSearchPageUrl,
  formatAppleLocations,
  parseAppleJobs,
  parseAppleSearchConfig,
} from "../../lib/scraping/adapters/apple.ts";
import {
  buildAmazonPostingUrl,
  formatAmazonLocations,
  parseAmazonJobs,
  parseAmazonPostedDate,
  resolveAmazonBoard,
} from "../../lib/scraping/adapters/amazon.ts";
import {
  buildByteDancePostingUrl,
  extractByteDanceDetailDatePosted,
  formatByteDanceLocations,
  isByteDanceListCandidate,
  isByteDanceTikTokScopedJob,
  parseByteDanceJobs,
  parseByteDanceSearchQueries,
  readByteDanceJobDatePosted,
  resolveByteDanceBoard,
} from "../../lib/scraping/adapters/bytedance.ts";
import { parseLifeAtTikTokSearchHtml } from "../../lib/scraping/adapters/lifeattiktok.ts";
import {
  buildMetaPostingUrl,
  buildMetaSearchInput,
  formatMetaLocations,
  parseMetaJobPostingJsonLd,
  parseMetaJobs,
  parseMetaSearchQueries,
} from "../../lib/scraping/adapters/meta.ts";
import {
  buildSalesforceRssUrl,
  formatSalesforceLocation,
  parseSalesforceJobs,
  parseSalesforceRssXml,
  resolveSalesforceBoard,
} from "../../lib/scraping/adapters/salesforce.ts";
import {
  buildUberPostingUrl,
  formatUberLocations,
  isUberListCandidate,
  parseUberJobs,
  parseUberSearchFilters,
} from "../../lib/scraping/adapters/uber.ts";
import {
  JPMORGAN_DEFAULT_CAREERS_URL,
  JPMORGAN_DEFAULT_SITE_NUMBER,
  buildJpmorganDetailsFinder,
  buildJpmorganPostingUrl,
  buildJpmorganRequisitionsFinder,
  formatJpmorganDescription,
  formatJpmorganLocations,
  isJpmorganListCandidate,
  parseJpmorganCareersUrl,
  parseJpmorganPostings,
  resolveJpmorganBoard,
} from "../../lib/scraping/adapters/jpmorgan-chase.ts";
import {
  GOLDMAN_DEFAULT_CAREERS_URL,
  GOLDMAN_DEFAULT_SITE_NUMBER,
  buildGoldmanDetailsFinder,
  buildGoldmanPostingUrl,
  buildGoldmanRequisitionsFinder,
  formatGoldmanDescription,
  formatGoldmanLocations,
  isGoldmanListCandidate,
  parseGoldmanCareersUrl,
  parseGoldmanPostings,
  resolveGoldmanBoard,
} from "../../lib/scraping/adapters/goldman-sachs.ts";
import {
  SHOPIFY_CAREERS_FEED_URL,
  buildShopifyPostingUrl,
  formatShopifyLocations,
  isShopifyFeedUrl,
  isShopifyListCandidate,
  normalizeShopifyPostingUrl,
  parseShopifyFeedXml,
  parseShopifyJobs,
  parseShopifyListDate,
  resolveShopifyBoard,
} from "../../lib/scraping/adapters/shopify.ts";
import {
  NETFLIX_DEFAULT_SOURCE_URL,
  buildNetflixPostingUrl,
  parseNetflixCareersHtml,
  parseNetflixPostings,
  resolveNetflixBoard,
} from "../../lib/scraping/adapters/netflix.ts";
import {
  MILLENNIUM_DEFAULT_SOURCE_URL,
  buildMillenniumPostingUrl,
  buildMillenniumSearchUrl,
  parseMillenniumPostings,
  parseMillenniumSmartApplyHtml,
  resolveMillenniumBoard,
} from "../../lib/scraping/adapters/millennium.ts";
import {
  ORACLE_DEFAULT_CAREERS_URL,
  ORACLE_DEFAULT_SITE_NUMBER,
  buildOracleDetailsFinder,
  buildOraclePostingUrl,
  buildOracleRequisitionsFinder,
  formatOracleDescription,
  formatOracleLocations,
  isOracleListCandidate,
  parseOracleCareersUrl,
  parseOraclePostings,
  resolveOracleBoard,
} from "../../lib/scraping/adapters/oracle.ts";
import {
  LINKEDIN_DEFAULT_COMPANY_IDS,
  buildLinkedInPostingUrl,
  buildLinkedInSearchUrl,
  parseLinkedInJobPostingHtml,
  parseLinkedInJobs,
  parseLinkedInSearchJobIds,
  parseLinkedInSearchSummaries,
  resolveLinkedInBoard,
  shouldPrefetchLinkedInDetail,
} from "../../lib/scraping/adapters/linkedin.ts";
import {
  INTUIT_CAREERS_ORIGIN,
  INTUIT_DEFAULT_SEARCH_URL,
  parseIntuitJobDetailFields,
  parseIntuitJobs,
  parseIntuitSearchJobsHtml,
  resolveIntuitBoard,
  shouldPrefetchIntuitDetail,
} from "../../lib/scraping/adapters/intuit.ts";
import {
  CITIGROUP_CAREERS_ORIGIN,
  CITIGROUP_DEFAULT_SEARCH_URL,
  parseCitigroupJobDetailFields,
  parseCitigroupJobs,
  parseCitigroupSearchJobsHtml,
  resolveCitigroupBoard,
  shouldPrefetchCitigroupDetail,
} from "../../lib/scraping/adapters/citigroup.ts";
import {
  L3HARRIS_CAREERS_ORIGIN,
  L3HARRIS_DEFAULT_SEARCH_URL,
  parseL3HarrisJobDetailFields,
  parseL3HarrisJobs,
  parseL3HarrisSearchJobsHtml,
  resolveL3HarrisBoard,
  shouldPrefetchL3HarrisDetail,
} from "../../lib/scraping/adapters/l3harris.ts";
import {
  ARM_CAREERS_ORIGIN,
  ARM_DEFAULT_SEARCH_URL,
  buildArmPostingUrl,
  parseArmJobDetailFields,
  parseArmJobs,
  parseArmSearchJobsHtml,
  resolveArmBoard,
  shouldPrefetchArmDetail,
} from "../../lib/scraping/adapters/arm.ts";
import {
  SYNOPSYS_CAREERS_ORIGIN,
  SYNOPSYS_DEFAULT_SEARCH_URL,
  parseSynopsysJobDetailFields,
  parseSynopsysJobs,
  parseSynopsysSearchJobsHtml,
  resolveSynopsysBoard,
  shouldPrefetchSynopsysDetail,
} from "../../lib/scraping/adapters/synopsys.ts";
import {
  GENERAL_DYNAMICS_CAREERS_ORIGIN,
  GENERAL_DYNAMICS_JOB_SEARCH_URL,
  buildGeneralDynamicsPostingUrl,
  encodeGeneralDynamicsCareerSearchRequest,
  isGeneralDynamicsListCandidate,
  parseGeneralDynamicsApiAuthFromHtml,
  parseGeneralDynamicsJobDetailFields,
  parseGeneralDynamicsJobs,
  parseGeneralDynamicsSearchResponse,
  resolveGeneralDynamicsBoard,
} from "../../lib/scraping/adapters/general-dynamics.ts";
import {
  BAE_SYSTEMS_DEFAULT_SEARCH_URL,
  buildBaeSystemsPostingUrl,
  formatBaeSystemsLocations,
  isBaeSystemsListCandidate,
  parseBaeSystemsJobs,
  parseBaeSystemsSearchDdo,
  resolveBaeSystemsBoard,
} from "../../lib/scraping/adapters/bae-systems.ts";
import {
  WAYFAIR_CAREERS_ORIGIN,
  WAYFAIR_JOB_SEARCH_URL,
  buildWayfairPostingUrl,
  formatWayfairLocation,
  isWayfairListCandidate,
  parseWayfairJobSearchResponse,
  parseWayfairJobs,
  resolveWayfairBoard,
} from "../../lib/scraping/adapters/wayfair.ts";
import {
  ETSY_CAREERS_ORIGIN,
  ETSY_DEFAULT_SEARCH_URL,
  parseEtsyJobs,
  parseEtsyPostingUrl,
  parseEtsySitemapJobs,
  resolveEtsyBoard,
} from "../../lib/scraping/adapters/etsy.ts";
import {
  ATLASSIAN_LISTINGS_API_URL,
  buildAtlassianPostingUrl,
  formatAtlassianDescription,
  formatAtlassianLocations,
  isAtlassianListCandidate,
  isAtlassianListingsUrl,
  parseAtlassianJobs,
  parseAtlassianListingsResponse,
  resolveAtlassianBoard,
} from "../../lib/scraping/adapters/atlassian.ts";
import {
  buildTeslaPostingUrl,
  isTeslaListCandidate,
  parseTeslaJobs,
  resolveTeslaBoard,
  slugifyTeslaTitle,
  computeTeslaRetryDelayMs,
  parseTeslaRetryAfterMs,
} from "../../lib/scraping/adapters/tesla.ts";
import {
  buildWorkdayPostingUrl,
  parseWorkdayCareersUrl,
  parseWorkdayPostedOn,
  parseWorkdayPostings,
} from "../../lib/scraping/adapters/workday.ts";
import { inferSeason } from "../../lib/scraping/season.ts";
import type { CompanySourceConfig } from "../../lib/scraping/types.ts";

const stripeSource: CompanySourceConfig = {
  id: "src-stripe",
  companyId: "co-stripe",
  companySlug: "stripe",
  companyName: "Stripe",
  sourceType: "greenhouse",
  adapterKey: "stripe-greenhouse",
  sourceUrl: "https://boards.greenhouse.io/stripe",
  boardToken: "stripe",
};

const rampSource: CompanySourceConfig = {
  id: "src-ramp",
  companyId: "co-ramp",
  companySlug: "ramp",
  companyName: "Ramp",
  sourceType: "ashby",
  adapterKey: "ramp-ashby",
  sourceUrl: "https://jobs.ashbyhq.com/ramp",
  boardToken: "ramp",
};

test("inferSeason defaults to Summer", () => {
  assert.equal(inferSeason("Software Engineer Intern"), "Summer");
});

test("inferSeason detects Fall Spring Winter Summer", () => {
  assert.equal(inferSeason("Fall Intern"), "Fall");
  assert.equal(inferSeason("Spring Co-op"), "Spring");
  assert.equal(inferSeason("Winter Internship"), "Winter");
  assert.equal(inferSeason("Summer Intern"), "Summer");
});

test("parseGreenhouseJobs keeps engineering internships only", () => {
  const parsed = parseGreenhouseJobs(
    [
      {
        id: "1",
        title: "Software Engineer Intern",
        absolute_url: "https://boards.greenhouse.io/stripe/jobs/1",
        location: { name: "San Francisco, CA" },
        departments: [{ name: "5112 General University" }],
        updated_at: "2026-01-15T00:00:00Z",
        content: "Summer internship",
      },
      {
        id: "2",
        title: "Product Manager",
        absolute_url: "https://boards.greenhouse.io/stripe/jobs/2",
        location: { name: "San Francisco, CA" },
      },
      {
        id: "3",
        title: "Staff Engineer",
        absolute_url: "https://boards.greenhouse.io/stripe/jobs/3",
        location: { name: "San Francisco, CA" },
      },
    ],
    stripeSource,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Software Engineer Intern");
  assert.equal(parsed.stats.fetched, 3);
  assert.equal(parsed.stats.kept, 1);
});

test("parseGreenhouseJobs excludes new grad roles in university departments", () => {
  const parsed = parseGreenhouseJobs(
    [
      {
        id: "1",
        title: "Software Engineer Intern",
        absolute_url: "https://job-boards.greenhouse.io/scaleai/jobs/1",
        location: { name: "San Francisco, CA" },
        departments: [{ name: "University" }],
      },
      {
        id: "2",
        title: "Software Engineer - New Grad",
        absolute_url: "https://job-boards.greenhouse.io/scaleai/jobs/2",
        location: { name: "San Francisco, CA" },
        departments: [{ name: "University" }],
        metadata: [{ name: "Time Type", value: "Full Time" }],
      },
    ],
    stripeSource,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Software Engineer Intern");
});

test("parseGreenhouseEmploymentMetadata reads greenhouse time type fields", () => {
  const parsed = parseGreenhouseEmploymentMetadata([
    { name: "Employment Type", value: "Salaried Employee" },
    { name: "Time Type", value: "Full Time" },
  ]);

  assert.equal(parsed.employmentType, "Salaried Employee");
  assert.equal(parsed.commitment, "Full Time");
});

test("parseGreenhouseJobs skips invalid URLs", () => {
  const parsed = parseGreenhouseJobs(
    [
      {
        id: "3",
        title: "Software Engineer Intern",
        absolute_url: "not-a-url",
        location: { name: "San Francisco, CA" },
      },
    ],
    stripeSource,
  );
  assert.equal(parsed.roles.length, 0);
});

test("parseAshbyJobs joins secondary locations", () => {
  const location = formatAshbyLocation({
    id: "x",
    location: "New York",
    secondaryLocations: ["Remote US"],
  });
  assert.equal(location, "New York · Remote US");
});

test("collectAshbyLocations uses postalAddress for US roles", () => {
  const locations = collectAshbyLocations({
    id: "x",
    location: "San Francisco",
    address: {
      postalAddress: {
        addressLocality: "San Francisco",
        addressRegion: "California",
        addressCountry: "United States",
      },
    },
  });
  assert.ok(locations.includes("San Francisco, California, United States"));
});

test("formatUsAtsPostalAddress keeps non-US countries", () => {
  assert.equal(
    formatUsAtsPostalAddress({
      addressLocality: "London",
      addressCountry: "United Kingdom",
    }),
    "London, United Kingdom",
  );
});

test("normalizeAshbyEmploymentType maps Intern to Internship", () => {
  assert.match(normalizeAshbyEmploymentType("Intern", null) ?? "", /Internship/i);
});

test("parseAshbyJobs skips unlisted postings", () => {
  const parsed = parseAshbyJobs(
    [
      {
        id: "hidden",
        title: "Software Engineer Intern",
        jobUrl: "https://jobs.ashbyhq.com/ramp/hidden",
        location: "New York, NY",
        employmentType: "Intern",
        isListed: false,
      },
    ],
    rampSource,
  );
  assert.equal(parsed.roles.length, 0);
});

test("parseAshbyJobs keeps internships with published date", () => {
  const parsed = parseAshbyJobs(
    [
      {
        id: "abc",
        title: "Engineering Intern",
        jobUrl: "https://jobs.ashbyhq.com/ramp/abc",
        location: "New York, NY",
        employmentType: "Intern",
        publishedAt: "2026-02-01T12:00:00Z",
        description: "Fall program",
      },
    ],
    rampSource,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].season, "Fall");
  assert.equal(scrapedRolePublishedIso(parsed.roles[0]), "2026-02-01T12:00:00.000Z");
});

test("parseAshbyJobs nulls missing optional fields", () => {
  const parsed = parseAshbyJobs(
    [
      {
        id: "xyz",
        title: "Software Engineer Intern",
        jobUrl: "https://jobs.ashbyhq.com/ramp/xyz",
        location: "Remote US",
        employmentType: "Intern",
      },
    ],
    rampSource,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].location, "Remote US");
  assert.equal(scrapedRolePublishedIso(parsed.roles[0]), null);
});

test("parseLeverJobs keeps engineering internships with metadata", () => {
  const leverSource: CompanySourceConfig = {
    id: "src-palantir",
    companyId: "co-palantir",
    companySlug: "palantir",
    companyName: "Palantir",
    sourceType: "lever",
    adapterKey: "palantir-lever",
    sourceUrl: "https://jobs.lever.co/palantir",
    boardToken: "palantir",
  };

  const parsed = parseLeverJobs(
    [
      {
        id: "abc",
        text: "Software Engineer Intern",
        hostedUrl: "https://jobs.lever.co/palantir/abc",
        categories: {
          location: "New York, NY",
          allLocations: ["Denver, CO"],
          commitment: "Internship",
        },
        createdAt: 1_700_000_000_000,
      },
      {
        id: "def",
        text: "Forward Deployed Software Engineer, Internship",
        hostedUrl: "https://jobs.lever.co/palantir/def",
        categories: { location: "Denver, CO", commitment: "Internship" },
      },
      {
        id: "ghi",
        text: "Backend Software Engineer - Defense",
        hostedUrl: "https://jobs.lever.co/palantir/ghi",
        categories: { location: "Denver, CO", commitment: "Permanent" },
      },
      {
        id: "jkl",
        text: "Deployment Strategist, Internship",
        hostedUrl: "https://jobs.lever.co/palantir/jkl",
        categories: { location: "New York, NY", commitment: "Internship" },
      },
    ],
    leverSource,
  );

  assert.equal(parsed.roles.length, 2);
  assert.equal(parsed.roles[0].location, "New York, NY · Denver, CO");
  assert.equal(scrapedRolePublishedIso(parsed.roles[0]), "2023-11-14T22:13:20.000Z");
  assert.equal(parsed.roles[1].roleName, "Forward Deployed Software Engineer, Internship");
});

const intelWorkdaySource: CompanySourceConfig = {
  id: "src-intel",
  companyId: "co-intel",
  companySlug: "intel",
  companyName: "Intel",
  sourceType: "workday",
  adapterKey: "intel-workday",
  sourceUrl: "https://intel.wd1.myworkdayjobs.com/en-US/External",
  boardToken: "External",
};

const workdayReferenceDate = new Date("2026-05-30T12:00:00.000Z");

test("parseWorkdayPostedOn maps relative postedOn strings to UTC midnight", () => {
  assert.equal(parseWorkdayPostedOn("Posted Today", workdayReferenceDate), "2026-05-30T00:00:00.000Z");
  assert.equal(
    parseWorkdayPostedOn("Posted Yesterday", workdayReferenceDate),
    "2026-05-29T00:00:00.000Z",
  );
  assert.equal(
    parseWorkdayPostedOn("Posted 7 Days Ago", workdayReferenceDate),
    "2026-05-23T00:00:00.000Z",
  );
  assert.equal(
    parseWorkdayPostedOn("Posted 3 Days Ago", workdayReferenceDate),
    "2026-05-27T00:00:00.000Z",
  );
  assert.equal(
    parseWorkdayPostedOn("Posted 30+ Days Ago", workdayReferenceDate),
    "2026-04-15T00:00:00.000Z",
  );
  assert.equal(
    parseWorkdayPostedOn("Posted 1 Week Ago", workdayReferenceDate),
    "2026-05-23T00:00:00.000Z",
  );
  assert.equal(parseWorkdayPostedOn(null, workdayReferenceDate), null);
  assert.equal(parseWorkdayPostedOn("Posted recently", workdayReferenceDate), null);
});

test("parseWorkdayCareersUrl resolves tenant site and posting base", () => {
  const board = parseWorkdayCareersUrl(intelWorkdaySource.sourceUrl, intelWorkdaySource.boardToken);
  assert.equal(board.tenant, "intel");
  assert.equal(board.wdInstance, "wd1");
  assert.equal(board.site, "External");
  assert.equal(board.careersOrigin, "https://intel.wd1.myworkdayjobs.com/en-US/External");
  assert.equal(
    board.cxsJobsUrl,
    "https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/External/jobs",
  );

  const postingUrl = buildWorkdayPostingUrl(
    board,
    "/job/US-Oregon-Hillsboro/Software-Engineering-Intern_JR123",
  );
  assert.equal(
    postingUrl,
    "https://intel.wd1.myworkdayjobs.com/en-US/External/job/US-Oregon-Hillsboro/Software-Engineering-Intern_JR123",
  );
});

test("parseWorkdayPostings keeps engineering internships from enriched postings", () => {
  const board = parseWorkdayCareersUrl(intelWorkdaySource.sourceUrl, intelWorkdaySource.boardToken);
  const fixture = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/workday-intel-intern.json"), "utf8"),
  );

  const parsed = parseWorkdayPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    intelWorkdaySource,
    board,
    1,
    workdayReferenceDate,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Software Engineering Intern");
  assert.match(parsed.roles[0].postingUrl, /myworkdayjobs\.com/);
  assert.equal(scrapedRolePublishedIso(parsed.roles[0]), null);
});

const hrtSource: CompanySourceConfig = {
  id: "src-hrt",
  companyId: "co-hrt",
  companySlug: "hudson-river-trading",
  companyName: "Hudson River Trading",
  sourceType: "hudson_river_trading",
  adapterKey: "hudson-river-trading-greenhouse",
  sourceUrl: HRT_GREENHOUSE_CAREERS_URL,
  boardToken: HRT_GREENHOUSE_BOARD_TOKEN,
};

test("resolveHrtGreenhouseSource rewrites careers site URL to hrttalentcommunity board", () => {
  const resolved = resolveHrtGreenhouseSource({
    ...hrtSource,
    sourceUrl: "https://www.hudsonrivertrading.com/careers/",
    boardToken: null,
  });

  assert.equal(resolved.sourceUrl, HRT_GREENHOUSE_CAREERS_URL);
  assert.equal(resolved.boardToken, HRT_GREENHOUSE_BOARD_TOKEN);
});

test("parseGreenhouseJobs keeps HRT engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/hrt-greenhouse.json"),
      "utf8",
    ),
  );

  const parsed = parseGreenhouseJobs(fixture.jobs, hrtSource);

  assert.equal(parsed.stats.fetched, 3);
  assert.equal(parsed.roles.length, 1);
  assert.equal(
    parsed.roles[0].roleName,
    "FPGA Verification and Developer (Internships and Campus Full-time)",
  );
  assert.equal(parsed.roles[0].companyName, "Hudson River Trading");
  assert.match(parsed.roles[0].postingUrl, /hrttalentcommunity\/jobs\/4576493/);
});

const towerResearchSource: CompanySourceConfig = {
  id: "src-tower-research",
  companyId: "co-tower-research",
  companySlug: "tower-research",
  companyName: "Tower Research Capital",
  sourceType: "tower_research",
  adapterKey: "tower-research-greenhouse",
  sourceUrl: TOWER_RESEARCH_CAREERS_URL,
  boardToken: TOWER_RESEARCH_GREENHOUSE_BOARD_TOKEN,
};

test("resolveTowerResearchGreenhouseSource rewrites careers site URL to towerresearchcapital board", () => {
  const resolved = resolveTowerResearchGreenhouseSource({
    ...towerResearchSource,
    sourceUrl: "https://tower-research.com/careers/",
    boardToken: null,
  });

  assert.equal(resolved.sourceUrl, TOWER_RESEARCH_CAREERS_URL);
  assert.equal(resolved.boardToken, TOWER_RESEARCH_GREENHOUSE_BOARD_TOKEN);
});

test("parseGreenhouseJobs keeps US internships from Tower Research fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../fixtures/scrape/tower-research-greenhouse.json",
      ),
      "utf8",
    ),
  );

  const parsed = parseGreenhouseJobs(fixture.jobs, towerResearchSource);

  assert.equal(parsed.stats.fetched, 2);
  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Quantitative Researcher Intern");
  assert.equal(parsed.roles[0].companyName, "Tower Research Capital");
  assert.match(parsed.roles[0].postingUrl, /tower-research\.com\/open-positions\/\?gh_jid=7238472/);
});

const fiveRingsSource: CompanySourceConfig = {
  id: "src-five-rings",
  companyId: "co-five-rings",
  companySlug: "five-rings",
  companyName: "Five Rings",
  sourceType: "five_rings",
  adapterKey: "five-rings-greenhouse",
  sourceUrl: FIVE_RINGS_CAREERS_URL,
  boardToken: FIVE_RINGS_GREENHOUSE_BOARD_TOKEN,
};

test("resolveFiveRingsGreenhouseSource rewrites careers site URL to fiveringsllc board", () => {
  const resolved = resolveFiveRingsGreenhouseSource({
    ...fiveRingsSource,
    sourceUrl: "https://fiverings.com/careers/",
    boardToken: null,
  });

  assert.equal(resolved.sourceUrl, FIVE_RINGS_CAREERS_URL);
  assert.equal(resolved.boardToken, FIVE_RINGS_GREENHOUSE_BOARD_TOKEN);
});

test("parseGreenhouseJobs keeps US internships from Five Rings fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../fixtures/scrape/five-rings-greenhouse.json",
      ),
      "utf8",
    ),
  );

  const parsed = parseGreenhouseJobs(fixture.jobs, fiveRingsSource);

  assert.equal(parsed.stats.fetched, 3);
  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "LINK 2026: Software Development Intensive Program");
  assert.equal(parsed.roles[0].companyName, "Five Rings");
  assert.match(parsed.roles[0].postingUrl, /fiveringsllc\/jobs\/4988120008/);
});

const nvidiaSource: CompanySourceConfig = {
  id: "src-nvidia",
  companyId: "co-nvidia",
  companySlug: "nvidia",
  companyName: "NVIDIA",
  sourceType: "nvidia",
  adapterKey: "nvidia-workday",
  sourceUrl: NVIDIA_WORKDAY_CAREERS_URL,
  boardToken: "NVIDIAExternalCareerSite",
};

test("resolveNvidiaWorkdaySource rewrites legacy jobs.nvidia.com URL", () => {
  const resolved = resolveNvidiaWorkdaySource({
    ...nvidiaSource,
    sourceUrl: "https://jobs.nvidia.com",
    boardToken: null,
  });

  assert.equal(resolved.sourceUrl, NVIDIA_WORKDAY_CAREERS_URL);
  assert.equal(resolved.boardToken, "NVIDIAExternalCareerSite");
});

test("parseWorkdayPostings keeps US engineering internships for NVIDIA fixture", () => {
  const board = parseWorkdayCareersUrl(nvidiaSource.sourceUrl, nvidiaSource.boardToken);
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/workday-nvidia-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseWorkdayPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    nvidiaSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Software Engineering Intern, JAX - Fall 2026");
  assert.equal(parsed.roles[0].season, "Fall");
  assert.match(parsed.roles[0].postingUrl, /nvidia\.wd5\.myworkdayjobs\.com/);
});

const rtxSource: CompanySourceConfig = {
  id: "src-rtx",
  companyId: "co-rtx",
  companySlug: "rtx",
  companyName: "RTX",
  sourceType: "rtx",
  adapterKey: "rtx-workday",
  sourceUrl: RTX_WORKDAY_CAREERS_URL,
  boardToken: "REC_RTX_Ext_Gateway",
};

test("resolveRtxWorkdaySource rewrites careers.rtx.com URL", () => {
  const resolved = resolveRtxWorkdaySource({
    ...rtxSource,
    sourceUrl: "https://careers.rtx.com/global/en/",
    boardToken: null,
  });

  assert.equal(resolved.sourceUrl, RTX_WORKDAY_CAREERS_URL);
  assert.equal(resolved.boardToken, "REC_RTX_Ext_Gateway");
});

test("parseWorkdayCareersUrl resolves RTX REC_RTX_Ext_Gateway board", () => {
  const board = parseWorkdayCareersUrl(rtxSource.sourceUrl, rtxSource.boardToken);
  assert.equal(board.tenant, "globalhr");
  assert.equal(board.site, "REC_RTX_Ext_Gateway");
  assert.match(board.cxsJobsUrl, /globalhr\/REC_RTX_Ext_Gateway\/jobs$/);
});

test("parseWorkdayPostings keeps US engineering co-ops for RTX fixture", () => {
  const board = parseWorkdayCareersUrl(rtxSource.sourceUrl, rtxSource.boardToken);
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/workday-rtx-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseWorkdayPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    rtxSource,
    board,
    1,
    workdayReferenceDate,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(
    parsed.roles[0].roleName,
    "2026 Raytheon Part Time Co-op - Software  Engineer (Remote)",
  );
  assert.equal(parsed.roles[0].season, "Summer");
  assert.match(parsed.roles[0].postingUrl, /globalhr\.wd5\.myworkdayjobs\.com/);
  assert.equal(scrapedRolePublishedIso(parsed.roles[0]), "2026-05-27T00:00:00.000Z");
});

const snapWorkdaySource: CompanySourceConfig = {
  id: "src-snap",
  companyId: "co-snap",
  companySlug: "snap",
  companyName: "Snap Inc.",
  sourceType: "workday",
  adapterKey: "snap-workday",
  sourceUrl: "https://snapchat.wd1.myworkdayjobs.com/sourced",
  boardToken: "sourced",
};

test("parseWorkdayCareersUrl resolves Snap sourced board", () => {
  const board = parseWorkdayCareersUrl(snapWorkdaySource.sourceUrl, snapWorkdaySource.boardToken);
  assert.equal(board.tenant, "snapchat");
  assert.equal(board.site, "sourced");
  assert.equal(
    board.cxsJobsUrl,
    "https://snapchat.wd1.myworkdayjobs.com/wday/cxs/snapchat/sourced/jobs",
  );

  const postingUrl = buildWorkdayPostingUrl(
    board,
    "/job/Los-Angeles-California/Security-Engineer-Intern--Summer-2026_R0044499",
  );
  assert.equal(
    postingUrl,
    "https://snapchat.wd1.myworkdayjobs.com/en-US/sourced/job/Los-Angeles-California/Security-Engineer-Intern--Summer-2026_R0044499",
  );
});

const paypalWorkdaySource: CompanySourceConfig = {
  id: "src-paypal",
  companyId: "co-paypal",
  companySlug: "paypal",
  companyName: "PayPal",
  sourceType: "workday",
  adapterKey: "paypal-workday",
  sourceUrl: "https://paypal.wd1.myworkdayjobs.com/jobs",
  boardToken: "jobs",
};

test("parseWorkdayCareersUrl resolves PayPal jobs board", () => {
  const board = parseWorkdayCareersUrl(
    paypalWorkdaySource.sourceUrl,
    paypalWorkdaySource.boardToken,
  );
  assert.equal(board.tenant, "paypal");
  assert.equal(board.wdInstance, "wd1");
  assert.equal(board.site, "jobs");
  assert.equal(
    board.cxsJobsUrl,
    "https://paypal.wd1.myworkdayjobs.com/wday/cxs/paypal/jobs/jobs",
  );

  const postingUrl = buildWorkdayPostingUrl(
    board,
    "/job/San-Jose-California-United-States-of-America/Software-Engineer-Intern_R0123456",
  );
  assert.equal(
    postingUrl,
    "https://paypal.wd1.myworkdayjobs.com/en-US/jobs/job/San-Jose-California-United-States-of-America/Software-Engineer-Intern_R0123456",
  );
});

test("parseWorkdayPostings keeps US engineering internships for PayPal fixture", () => {
  const board = parseWorkdayCareersUrl(
    paypalWorkdaySource.sourceUrl,
    paypalWorkdaySource.boardToken,
  );
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/workday-paypal-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseWorkdayPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    paypalWorkdaySource,
    board,
    1,
    workdayReferenceDate,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Software Engineer Intern");
  assert.match(parsed.roles[0].postingUrl, /paypal\.wd1\.myworkdayjobs\.com/);
  assert.equal(scrapedRolePublishedIso(parsed.roles[0]), "2026-05-23T00:00:00.000Z");
});

test("parseWorkdayPostings keeps US engineering internships for Snap fixture", () => {
  const board = parseWorkdayCareersUrl(snapWorkdaySource.sourceUrl, snapWorkdaySource.boardToken);
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/workday-snap-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseWorkdayPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    snapWorkdaySource,
    board,
    1,
    workdayReferenceDate,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Security Engineer Intern, Summer 2026");
  assert.equal(parsed.roles[0].season, "Summer");
  assert.match(parsed.roles[0].postingUrl, /snapchat\.wd1\.myworkdayjobs\.com/);
  assert.equal(scrapedRolePublishedIso(parsed.roles[0]), "2026-04-15T00:00:00.000Z");
});

const crowdstrikeWorkdaySource: CompanySourceConfig = {
  id: "src-crowdstrike",
  companyId: "co-crowdstrike",
  companySlug: "crowdstrike",
  companyName: "CrowdStrike",
  sourceType: "workday",
  adapterKey: "crowdstrike-workday",
  sourceUrl: "https://crowdstrike.wd5.myworkdayjobs.com/en-US/crowdstrikecareers",
  boardToken: "crowdstrikecareers",
};

test("parseWorkdayCareersUrl resolves CrowdStrike crowdstrikecareers board", () => {
  const board = parseWorkdayCareersUrl(
    crowdstrikeWorkdaySource.sourceUrl,
    crowdstrikeWorkdaySource.boardToken,
  );
  assert.equal(board.tenant, "crowdstrike");
  assert.equal(board.wdInstance, "wd5");
  assert.equal(board.site, "crowdstrikecareers");
  assert.equal(
    board.cxsJobsUrl,
    "https://crowdstrike.wd5.myworkdayjobs.com/wday/cxs/crowdstrike/crowdstrikecareers/jobs",
  );

  const postingUrl = buildWorkdayPostingUrl(
    board,
    "/job/USA---Remote/GenAI-Engineering-Intern----SkillBridge--Remote-_R26742",
  );
  assert.equal(
    postingUrl,
    "https://crowdstrike.wd5.myworkdayjobs.com/en-US/crowdstrikecareers/job/USA---Remote/GenAI-Engineering-Intern----SkillBridge--Remote-_R26742",
  );
});

test("parseWorkdayPostings keeps US engineering internships for CrowdStrike fixture", () => {
  const board = parseWorkdayCareersUrl(
    crowdstrikeWorkdaySource.sourceUrl,
    crowdstrikeWorkdaySource.boardToken,
  );
  const fixture = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../fixtures/scrape/workday-crowdstrike-intern.json",
      ),
      "utf8",
    ),
  );

  const parsed = parseWorkdayPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    crowdstrikeWorkdaySource,
    board,
    1,
    workdayReferenceDate,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "GenAI Engineering Intern  - SkillBridge (Remote)");
  assert.match(parsed.roles[0].postingUrl, /crowdstrike\.wd5\.myworkdayjobs\.com/);
  assert.equal(scrapedRolePublishedIso(parsed.roles[0]), "2026-04-15T00:00:00.000Z");
});

const splunkSource: CompanySourceConfig = {
  id: "src-splunk",
  companyId: "co-splunk",
  companySlug: "splunk",
  companyName: "Splunk",
  sourceType: "splunk",
  adapterKey: "splunk-cisco-workday",
  sourceUrl: SPLUNK_CISCO_CAREERS_URL,
  boardToken: SPLUNK_CISCO_BOARD_TOKEN,
};

test("parseWorkdayCareersUrl resolves Splunk Cisco_Careers board", () => {
  const board = parseWorkdayCareersUrl(splunkSource.sourceUrl, splunkSource.boardToken);
  assert.equal(board.tenant, "cisco");
  assert.equal(board.site, "Cisco_Careers");
  assert.equal(
    board.cxsJobsUrl,
    "https://cisco.wd5.myworkdayjobs.com/wday/cxs/cisco/Cisco_Careers/jobs",
  );
});

test("isSlackRelatedJob matches Salesforce careers Slack brand listings", () => {
  assert.equal(
    isSlackRelatedJob({
      title: "Software Engineer II, Cloud Infrastructure - Slack",
      url: "https://careers.salesforce.com/en/jobs/jr341727/software-engineer-ii-cloud-infrastructure-slack/",
      description: "",
      city: null,
      state: null,
      country: null,
      datePosted: null,
      jobType: null,
      category: null,
    }),
    true,
  );
  assert.equal(
    isSlackRelatedJob({
      title: "Account Executive, Enterprise",
      url: "https://careers.salesforce.com/en/jobs/jr100/account-executive/",
      description: "Collaborate via Slack and email.",
      city: null,
      state: null,
      country: null,
      datePosted: null,
      jobType: null,
      category: null,
    }),
    false,
  );
});

test("resolveSapBoard builds US intern RSS feed from board token", () => {
  const board = resolveSapBoard({
    id: "src-sap",
    companyId: "co-sap",
    companySlug: "sap",
    companyName: "SAP",
    sourceType: "sap",
    adapterKey: "sap-us-intern-rss",
    sourceUrl: SAP_US_INTERN_RSS_URL,
    boardToken: SAP_US_INTERN_CATEGORY_ID,
  });
  assert.equal(board.feedUrl, SAP_US_INTERN_RSS_URL);
});

test("parseSapRssXml reads item title and link", () => {
  const xml = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/sap-rss-snippet.xml"),
    "utf8",
  );
  const items = parseSapRssXml(xml);
  assert.equal(items.length, 1);
  assert.match(items[0].title, /SAP iXp Intern/);
  assert.match(items[0].link ?? "", /jobs\.sap\.com\/job\//);
});

test("extractSapLocationFromTitle reads trailing location segment", () => {
  const location = extractSapLocationFromTitle(
    "SAP iXp Intern - AI Software Developer (San Ramon, CA, US, 94583)",
  );
  assert.match(location ?? "", /San Ramon, CA/);
});

test("parseSapJobs keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/sap-ixp-software-intern.json"),
      "utf8",
    ),
  );
  const sapSource: CompanySourceConfig = {
    id: "src-sap",
    companyId: "co-sap",
    companySlug: "sap",
    companyName: "SAP",
    sourceType: "sap",
    adapterKey: "sap-us-intern-rss",
    sourceUrl: SAP_US_INTERN_RSS_URL,
    boardToken: SAP_US_INTERN_CATEGORY_ID,
  };

  assert.ok(isSapListCandidate(fixture));
  const parsed = parseSapJobs([fixture], sapSource, 1);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Developer/);
  assert.match(parsed.roles[0].postingUrl, /jobs\.sap\.com\/job\//);
  assert.equal(
    normalizeSapPostingUrl(`${fixture.link}?utm_source=test`),
    fixture.link,
  );
});

test("parseTeradataSearchResponse keeps US intern from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/teradata-intern-search.json"),
      "utf8",
    ),
  );
  const nodes = parseTeradataSearchResponse(fixture, TERADATA_GRAPHQL_URL);
  assert.equal(nodes.length, 1);
  assert.ok(isTeradataListCandidate(nodes[0]));

  const teradataSource: CompanySourceConfig = {
    id: "src-teradata",
    companyId: "co-teradata",
    companySlug: "teradata",
    companyName: "Teradata",
    sourceType: "teradata",
    adapterKey: "teradata-gr8people",
    sourceUrl: TERADATA_DEFAULT_CAREERS_URL,
    boardToken: null,
  };
  const board = resolveTeradataBoard(teradataSource);
  const parsed = parseTeradataJobs(nodes, teradataSource, board, 1);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Intern/);
  assert.equal(
    parsed.roles[0].postingUrl,
    buildTeradataPostingUrl(board, nodes[0]),
  );
  assert.match(parsed.roles[0].postingUrl, /careers\.teradata\.com\/jobs\/219548/);
});

test("parseChewyRefineSearchResponse keeps US intern from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/chewy-intern-refine.json"),
      "utf8",
    ),
  );
  const jobs = parseChewyRefineSearchResponse(fixture, "https://careers.chewy.com/widgets");
  assert.equal(jobs.length, 1);
  assert.ok(isChewyListCandidate(jobs[0]));

  const chewySource: CompanySourceConfig = {
    id: "src-chewy",
    companyId: "co-chewy",
    companySlug: "chewy",
    companyName: "Chewy",
    sourceType: "chewy",
    adapterKey: "chewy-phenom",
    sourceUrl: CHEWY_DEFAULT_CAREERS_URL,
    boardToken: CHEWY_DEFAULT_REF_NUM,
  };
  const board = resolveChewyBoard(chewySource);
  const parsed = parseChewyJobs(
    [{ summary: jobs[0], detail: null }],
    chewySource,
    board,
    1,
  );
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Intern/);
  assert.equal(parsed.roles[0].postingUrl, buildChewyPostingUrl(board, jobs[0]));
  assert.match(parsed.roles[0].postingUrl, /careers\.chewy\.com\/us\/en\/job\/R99999/);
});

test("parsePeak6Jobs keeps PCEP intern from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/peak6-pcep-intern.json"),
      "utf8",
    ),
  );

  const peak6Source: CompanySourceConfig = {
    id: "src-peak6",
    companyId: "co-peak6",
    companySlug: "peak6",
    companyName: "PEAK6",
    sourceType: "peak6",
    adapterKey: "peak6-ongig",
    sourceUrl: PEAK6_CAREERS_URL,
    boardToken: PEAK6_DEFAULT_GROUP_ID,
  };
  const board = resolvePeak6Board(peak6Source);
  assert.ok(isPeak6ListCandidate(fixture));

  const parsed = parsePeak6Jobs([fixture], peak6Source, board, 1);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /PCEP Intern/);
  assert.equal(
    parsed.roles[0].postingUrl,
    buildPeak6PostingUrl(board, fixture),
  );
  assert.match(parsed.roles[0].postingUrl, /peak6-prod\.ongig\.com\/jobs\//);
  assert.match(parsed.roles[0].location ?? "", /Portland/);
});

test("resolvePeak6Board defaults group id and jobs origin", () => {
  const board = resolvePeak6Board({
    id: "src-peak6",
    companyId: "co-peak6",
    companySlug: "peak6",
    companyName: "PEAK6",
    sourceType: "peak6",
    adapterKey: "peak6-ongig",
    sourceUrl: PEAK6_CAREERS_URL,
    boardToken: null,
  });
  assert.equal(board.groupId, PEAK6_DEFAULT_GROUP_ID);
  assert.equal(board.jobsOrigin, PEAK6_JOBS_ORIGIN);
});

test("parseWorkdayPostings keeps Splunk engineering internships from fixture", () => {
  const board = parseWorkdayCareersUrl(splunkSource.sourceUrl, splunkSource.boardToken);
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/splunk-backend-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseWorkdayPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    splunkSource,
    board,
    1,
    workdayReferenceDate,
  );

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer Intern/i);
  assert.match(parsed.roles[0].location ?? "", /Krakow/i);
});

test("parseWorkdayPostings rejects non-intern listings", () => {
  const board = parseWorkdayCareersUrl(intelWorkdaySource.sourceUrl, intelWorkdaySource.boardToken);
  const parsed = parseWorkdayPostings(
    [
      {
        summary: {
          title: "Senior Product Manager",
          externalPath: "/job/US/Product-Manager_JR999",
          locationsText: "Santa Clara, CA",
        },
        detail: {
          title: "Senior Product Manager",
          jobDescription: "<p>Lead product strategy.</p>",
          location: "Santa Clara, CA",
          timeType: "Full time",
        },
      },
    ],
    intelWorkdaySource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 0);
  assert.equal(parsed.stats.rejected[0]?.reason, "no_internship_signal");
});

const microsoftSource: CompanySourceConfig = {
  id: "src-microsoft",
  companyId: "co-microsoft",
  companySlug: "microsoft",
  companyName: "Microsoft",
  sourceType: "microsoft",
  adapterKey: "microsoft-pcsx",
  sourceUrl: "https://apply.careers.microsoft.com/careers",
  boardToken: "microsoft.com",
};

test("resolveMicrosoftBoard uses board_token domain for PCSX search", () => {
  const board = resolveMicrosoftBoard(microsoftSource);
  assert.equal(board.domain, "microsoft.com");
  assert.equal(board.searchUrl, "https://apply.careers.microsoft.com/api/pcsx/search");
});

test("parseMicrosoftPostings keeps US engineering internships from enriched postings", () => {
  const board = resolveMicrosoftBoard(microsoftSource);
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/microsoft-research-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseMicrosoftPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    microsoftSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Research Intern - Self-Improving AI");
  assert.match(parsed.roles[0].postingUrl, /apply\.careers\.microsoft\.com/);
  assert.match(parsed.roles[0].location ?? "", /Cambridge, MA, US/);
});

test("parseMicrosoftPostings keeps international PCSX engineering internships", () => {
  const board = resolveMicrosoftBoard(microsoftSource);
  const parsed = parseMicrosoftPostings(
    [
      {
        summary: {
          id: 2,
          name: "Software Engineering Intern",
          standardizedLocations: ["Hyderabad, TS, IN"],
          positionUrl: "/careers/job/2",
        },
        detail: {
          name: "Software Engineering Intern",
          job_description:
            "<p>Join our engineering internship program.</p><p>Computer science students.</p>",
          canonicalPositionUrl: "https://apply.careers.microsoft.com/careers/job/2",
        },
      },
      {
        summary: {
          id: 3,
          name: "Software Engineering Intern",
          standardizedLocations: ["Munich, BY, DE"],
          positionUrl: "/careers/job/3",
        },
        detail: {
          name: "Software Engineering Intern",
          job_description:
            "<p>Join our engineering internship program.</p><p>Computer science students.</p>",
          canonicalPositionUrl: "https://apply.careers.microsoft.com/careers/job/3",
        },
      },
    ],
    microsoftSource,
    board,
    2,
  );

  assert.equal(parsed.roles.length, 2);
  assert.ok(parsed.roles.every((role) => /Software Engineering Intern/i.test(role.roleName)));
});

test("parseMicrosoftPostings rejects non-intern listings", () => {
  const board = resolveMicrosoftBoard(microsoftSource);
  const parsed = parseMicrosoftPostings(
    [
      {
        summary: {
          id: 1,
          name: "Principal Product Manager",
          standardizedLocations: ["Redmond, WA, US"],
          positionUrl: "/careers/job/1",
        },
        detail: {
          name: "Principal Product Manager",
          job_description: "<p>Lead product strategy.</p>",
          canonicalPositionUrl: "https://apply.careers.microsoft.com/careers/job/1",
        },
      },
    ],
    microsoftSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 0);
  assert.equal(parsed.stats.rejected[0]?.reason, "no_internship_signal");
});

test("buildMicrosoftPostingUrl prefers canonical detail URL", () => {
  const board = resolveMicrosoftBoard(microsoftSource);
  const url = buildMicrosoftPostingUrl(
    board,
    { id: 99, positionUrl: "/careers/job/99" },
    { canonicalPositionUrl: "https://apply.careers.microsoft.com/careers/job/99" },
  );
  assert.equal(url, "https://apply.careers.microsoft.com/careers/job/99");
});

const qualcommSource: CompanySourceConfig = {
  id: "src-qualcomm",
  companyId: "co-qualcomm",
  companySlug: "qualcomm",
  companyName: "Qualcomm",
  sourceType: "qualcomm",
  adapterKey: "qualcomm-pcsx",
  sourceUrl: QUALCOMM_CAREERS_ORIGIN + "/careers",
  boardToken: "qualcomm.com",
};

test("isQualcommCareersUrl recognizes careers.qualcomm.com", () => {
  assert.equal(isQualcommCareersUrl("https://careers.qualcomm.com/careers"), true);
  assert.equal(isQualcommCareersUrl("https://apply.careers.microsoft.com/careers"), false);
});

test("resolveQualcommSource rewrites legacy source URL to PCSX careers origin", () => {
  const resolved = resolveQualcommSource({
    ...qualcommSource,
    sourceUrl: "https://www.qualcomm.com/careers",
    boardToken: null,
  });
  assert.equal(resolved.sourceUrl, `${QUALCOMM_CAREERS_ORIGIN}/careers`);
  assert.equal(resolved.boardToken, "qualcomm.com");
});

test("resolveMicrosoftBoard uses Qualcomm PCSX origin from source_url", () => {
  const board = resolveMicrosoftBoard(resolveQualcommSource(qualcommSource));
  assert.equal(board.domain, "qualcomm.com");
  assert.equal(board.searchUrl, `${QUALCOMM_CAREERS_ORIGIN}/api/pcsx/search`);
  assert.equal(board.careersOrigin, QUALCOMM_CAREERS_ORIGIN);
});

test("parseMicrosoftPostings keeps US engineering internships for Qualcomm fixture", () => {
  const board = resolveMicrosoftBoard(resolveQualcommSource(qualcommSource));
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/qualcomm-engineering-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseMicrosoftPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    qualcommSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "FY27 Intern - Software Engineering Intern - San Diego");
  assert.match(parsed.roles[0].postingUrl, /careers\.qualcomm\.com/);
  assert.match(parsed.roles[0].location ?? "", /San Diego, CA, US/);
});

const morganStanleySource: CompanySourceConfig = {
  id: "src-morgan-stanley",
  companyId: "co-morgan-stanley",
  companySlug: "morgan-stanley",
  companyName: "Morgan Stanley",
  sourceType: "morgan_stanley",
  adapterKey: "morgan-stanley-pcsx",
  sourceUrl: `${MORGAN_STANLEY_CAREERS_ORIGIN}/careers`,
  boardToken: "morganstanley.com",
};

test("isMorganStanleyCareersUrl recognizes morganstanley.eightfold.ai", () => {
  assert.equal(isMorganStanleyCareersUrl("https://morganstanley.eightfold.ai/careers"), true);
  assert.equal(isMorganStanleyCareersUrl("https://careers.qualcomm.com/careers"), false);
});

test("resolveMorganStanleySource rewrites legacy source URL to PCSX careers origin", () => {
  const resolved = resolveMorganStanleySource({
    ...morganStanleySource,
    sourceUrl: "https://www.morganstanley.com/careers",
    boardToken: null,
  });
  assert.equal(resolved.sourceUrl, `${MORGAN_STANLEY_CAREERS_ORIGIN}/careers`);
  assert.equal(resolved.boardToken, "morganstanley.com");
});

test("resolveMicrosoftBoard uses Morgan Stanley PCSX origin from source_url", () => {
  const board = resolveMicrosoftBoard(resolveMorganStanleySource(morganStanleySource));
  assert.equal(board.domain, "morganstanley.com");
  assert.equal(board.searchUrl, `${MORGAN_STANLEY_CAREERS_ORIGIN}/api/pcsx/search`);
  assert.equal(board.careersOrigin, MORGAN_STANLEY_CAREERS_ORIGIN);
});

test("parseMicrosoftPostings keeps US engineering internships for Morgan Stanley fixture", () => {
  const board = resolveMicrosoftBoard(resolveMorganStanleySource(morganStanleySource));
  const fixture = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../fixtures/scrape/morgan-stanley-technology-intern.json",
      ),
      "utf8",
    ),
  );

  const parsed = parseMicrosoftPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    morganStanleySource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Technology Summer Analyst/i);
  assert.match(parsed.roles[0].postingUrl, /morganstanley\.eightfold\.ai/);
  assert.match(parsed.roles[0].location ?? "", /New York, NY, US/);
});

const amdSource: CompanySourceConfig = {
  id: "src-amd",
  companyId: "co-amd",
  companySlug: "amd",
  companyName: "AMD",
  sourceType: "amd",
  adapterKey: "amd-jibe",
  sourceUrl: AMD_JOBS_API_URL,
  boardToken: AMD_DEFAULT_CATEGORY,
};

test("resolveAmdBoard uses Jibe intern category from board_token", () => {
  const board = resolveAmdBoard(amdSource);
  assert.equal(board.jobsApiUrl, AMD_JOBS_API_URL);
  assert.equal(board.internCategory, AMD_DEFAULT_CATEGORY);
  assert.equal(board.locale, "en-us");
});

test("buildAmdPostingUrl uses careers-home job slug", () => {
  const board = resolveAmdBoard(amdSource);
  const url = buildAmdPostingUrl(board, { slug: "86072", req_id: "86072" });
  assert.equal(url, "https://careers.amd.com/careers-home/jobs/86072?lang=en-us");
});

test("parseAmdJobs keeps US engineering internships from fixture", () => {
  const board = resolveAmdBoard(amdSource);
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/amd-swe-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseAmdJobs([fixture.job], amdSource, board, 1);

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Short Term 2026 Software Engineering Intern/Co-Op");
  assert.match(parsed.roles[0].postingUrl, /careers\.amd\.com\/careers-home\/jobs\/86072/);
  assert.match(parsed.roles[0].location ?? "", /Austin, TX, United States/);
  assert.equal(parsed.roles[0].season, "Summer");
});

test("parseAmdJobs rejects non-intern listings", () => {
  const board = resolveAmdBoard(amdSource);
  const parsed = parseAmdJobs(
    [
      {
        data: {
          slug: "99999",
          title: "Principal Product Manager",
          description: "<p>Lead product strategy.</p>",
          full_location: "Austin, TX, United States",
          country_code: "US",
          categories: [{ name: "Engineering" }],
        },
      },
    ],
    amdSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 0);
  assert.equal(parsed.stats.rejected[0]?.reason, "no_internship_signal");
});

const sigSource: CompanySourceConfig = {
  id: "src-sig",
  companyId: "co-sig",
  companySlug: "sig",
  companyName: "Susquehanna International Group",
  sourceType: "sig",
  adapterKey: "sig-jibe",
  sourceUrl: SIG_JOBS_API_URL,
  boardToken: SIG_DEFAULT_CATEGORY,
};

test("resolveSigBoard uses Jibe intern category from board_token", () => {
  const board = resolveSigBoard(sigSource);
  assert.equal(board.jobsApiUrl, SIG_JOBS_API_URL);
  assert.equal(board.internCategory, SIG_DEFAULT_CATEGORY);
  assert.equal(board.locale, "en-us");
});

test("buildSigPostingUrl uses careers job slug path", () => {
  const board = resolveSigBoard(sigSource);
  const url = buildSigPostingUrl(board, { slug: "10838", req_id: "10838" });
  assert.equal(url, "https://careers.sig.com/jobs/10838?lang=en-us");
});

test("parseSigJobs keeps US engineering internships from fixture", () => {
  const board = resolveSigBoard(sigSource);
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/sig-trading-system-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseSigJobs([fixture.job], sigSource, board, 1);

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Trading System Engineering Internship: Summer 2027");
  assert.match(parsed.roles[0].postingUrl, /careers\.sig\.com\/jobs\/10837/);
  assert.match(parsed.roles[0].location ?? "", /Bala Cynwyd/);
  assert.equal(parsed.roles[0].season, "Summer");
});

test("parseSigJobs rejects non-intern listings", () => {
  const board = resolveSigBoard(sigSource);
  const parsed = parseSigJobs(
    [
      {
        data: {
          slug: "99999",
          title: "Equity Options Trade Support Analyst",
          description: "<p>Support equity options trading desk.</p>",
          city: "Bala Cynwyd (Philadelphia Area)",
          state: "Pennsylvania",
          country: "United States",
          country_code: "US",
          categories: [{ name: "Experienced Professionals" }],
        },
      },
    ],
    sigSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 0);
  assert.equal(parsed.stats.rejected[0]?.reason, "no_internship_signal");
});

const rivianSource: CompanySourceConfig = {
  id: "src-rivian",
  companyId: "co-rivian",
  companySlug: "rivian",
  companyName: "Rivian",
  sourceType: "rivian",
  adapterKey: "rivian-jibe",
  sourceUrl: RIVIAN_JOBS_API_URL,
  boardToken: RIVIAN_DEFAULT_CATEGORY,
};

test("resolveRivianBoard uses Jibe Internships category from board_token", () => {
  const board = resolveRivianBoard(rivianSource);
  assert.equal(board.jobsApiUrl, RIVIAN_JOBS_API_URL);
  assert.equal(board.internCategory, RIVIAN_DEFAULT_CATEGORY);
  assert.equal(board.locale, "en-us");
});

test("buildRivianPostingUrl uses careers job slug path", () => {
  const board = resolveRivianBoard(rivianSource);
  const url = buildRivianPostingUrl(board, { slug: "30493", req_id: "30493" });
  assert.equal(url, "https://careers.rivian.com/jobs/30493?lang=en-us");
});

test("parseRivianJobs keeps US engineering internships from fixture", () => {
  const board = resolveRivianBoard(rivianSource);
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/rivian-hardware-safety-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseRivianJobs([fixture.job], rivianSource, board, 1);

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "UIUC Research Park Intern - Hardware Functional Safety");
  assert.match(parsed.roles[0].postingUrl, /careers\.rivian\.com\/jobs\/30493/);
  assert.match(parsed.roles[0].location ?? "", /Champaign, Illinois/);
  assert.equal(parsed.roles[0].season, "Summer");
});

test("parseRivianJobs rejects non-engineering intern listings", () => {
  const board = resolveRivianBoard(rivianSource);
  const parsed = parseRivianJobs(
    [
      {
        data: {
          slug: "99999",
          title: "Business and Administrative Intern - Product Development Finance",
          description: "<p>Support finance operations for product development.</p>",
          full_location: "Irvine, California",
          country_code: "US",
          categories: [{ name: "Internships" }],
        },
      },
    ],
    rivianSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 0);
  assert.equal(parsed.stats.rejected[0]?.reason, "non_engineering_role");
});

const githubSource: CompanySourceConfig = {
  id: "src-github",
  companyId: "co-github",
  companySlug: "github",
  companyName: "GitHub",
  sourceType: "github",
  adapterKey: "github-jibe",
  sourceUrl: GITHUB_JOBS_API_URL,
  boardToken: GITHUB_DEFAULT_BOARD_TOKEN,
};

test("resolveGithubBoard fetches all listings when board_token is all", () => {
  const board = resolveGithubBoard(githubSource);
  assert.equal(board.jobsApiUrl, GITHUB_JOBS_API_URL);
  assert.equal(board.fetchAllListings, true);
  assert.equal(board.internCategory, null);
  assert.equal(board.locale, "en-us");
});

test("buildGithubPostingUrl uses careers-home job slug path", () => {
  const board = resolveGithubBoard(githubSource);
  const url = buildGithubPostingUrl(board, { slug: "9001", req_id: "9001" });
  assert.equal(url, "https://www.github.careers/careers-home/jobs/9001?lang=en-us");
});

test("parseGithubJobs keeps US engineering internships from fixture", () => {
  const board = resolveGithubBoard(githubSource);
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/github-swe-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseGithubJobs([fixture.job], githubSource, board, 1);

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Software Engineering Intern");
  assert.match(parsed.roles[0].postingUrl, /github\.careers\/careers-home\/jobs\/9001/);
  assert.match(parsed.roles[0].location ?? "", /San Francisco/);
  assert.equal(parsed.roles[0].season, "Summer");
});

test("parseGithubJobs rejects senior roles without intern signals", () => {
  const board = resolveGithubBoard(githubSource);
  const parsed = parseGithubJobs(
    [
      {
        data: {
          slug: "5413",
          title: "Senior Software Engineer",
          description: "<p>Lead backend systems for GitHub.</p>",
          full_location: "Remote, United States",
          country_code: "US",
          categories: [{ name: "Engineering" }],
        },
      },
    ],
    githubSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 0);
});

const googleSource: CompanySourceConfig = {
  id: "src-google",
  companyId: "co-google",
  companySlug: "google",
  companyName: "Google",
  sourceType: "google",
  adapterKey: "google-careers",
  sourceUrl:
    "https://www.google.com/about/careers/applications/jobs/results/?location=United%20States&target_level=INTERN_AND_APPRENTICE&organization=Google",
  boardToken: null,
};

test("resolveGoogleSearchUrl falls back to default intern US search", () => {
  assert.match(resolveGoogleSearchUrl({ ...googleSource, sourceUrl: "" }), /target_level=INTERN_AND_APPRENTICE/);
});

test("buildGooglePostingUrl uses public job results path", () => {
  const url = buildGooglePostingUrl("140245524367188678");
  assert.equal(
    url,
    "https://www.google.com/about/careers/applications/jobs/results/140245524367188678",
  );
});

test("googleJobLocations joins primary location labels", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/google-intern-us.json"),
      "utf8",
    ),
  );
  const job = fixture.jobs[0];
  const locations = googleJobLocations(job);
  assert.ok(locations.length >= 2);
  assert.equal(locations[0], "Mountain View, CA, USA");
  assert.ok(locations.some((loc: string) => loc.includes("Ann Arbor")));
});

test("googleJobLocations keeps all country tuples", () => {
  const job: unknown[] = [
    "id",
    "Intern",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    [
      ["London, UK", null, "London", null, null, "GB"],
      ["Mountain View, CA, USA", null, "Mountain View", null, "CA", "US"],
    ],
  ];
  const locations = googleJobLocations(job);
  assert.deepEqual(locations, ["London, UK", "Mountain View, CA, USA"]);
});

test("parseGoogleJobs keeps student researcher internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/google-intern-us.json"),
      "utf8",
    ),
  );

  const parsed = parseGoogleJobs(fixture.jobs, googleSource);
  const keptTitles = parsed.roles.map((role) => role.roleName);
  assert.ok(keptTitles.some((title) => /Student Researcher/i.test(title)));
  assert.ok(parsed.roles.every((role) => role.postingUrl.includes("/jobs/results/")));
  assert.equal(parsed.stats.fetched, fixture.jobs.length);
});

const amazonSource: CompanySourceConfig = {
  id: "src-amazon",
  companyId: "co-amazon",
  companySlug: "amazon",
  companyName: "Amazon",
  sourceType: "amazon",
  adapterKey: "amazon-jobs",
  sourceUrl: "https://www.amazon.jobs",
  boardToken: "en",
};

test("resolveAmazonBoard uses locale board token and search.json path", () => {
  const board = resolveAmazonBoard(amazonSource);
  assert.equal(board.locale, "en");
  assert.equal(board.searchBaseUrl, "https://www.amazon.jobs/en/search.json");
  assert.equal(board.searchQuery, "intern");
});

test("formatAmazonLocations joins parsed multi-site labels", () => {
  const job = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/amazon-sde-intern.json"),
      "utf8",
    ),
  );
  const locations = formatAmazonLocations(job);
  assert.ok(locations.some((loc: string) => /Seattle/i.test(loc)));
  assert.ok(locations.some((loc: string) => /Sunnyvale/i.test(loc)));
});

test("parseAmazonPostedDate normalizes spaced month names", () => {
  const iso = parseAmazonPostedDate("December  3, 2025");
  assert.equal(iso, "2025-12-03T00:00:00.000Z");
});

test("parseAmazonJobs keeps US engineering internships from fixture", () => {
  const job = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/amazon-sde-intern.json"),
      "utf8",
    ),
  );
  const board = resolveAmazonBoard(amazonSource);
  const parsed = parseAmazonJobs([job], amazonSource, board, 1);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Development Engineer Intern/i);
  assert.equal(
    parsed.roles[0].postingUrl,
    buildAmazonPostingUrl(board, job),
  );
  assert.match(parsed.roles[0].postingUrl, /amazon\.jobs\/en\/jobs\/3136266/);
});

test("parseAmazonJobs rejects non-intern listings", () => {
  const board = resolveAmazonBoard(amazonSource);
  const parsed = parseAmazonJobs(
    [
      {
        title: "Senior Product Manager",
        job_path: "/en/jobs/999/senior-product-manager",
        country_code: "USA",
        location: "US, WA, Seattle",
        description: "Lead product strategy for retail.",
      },
    ],
    amazonSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 0);
  assert.equal(parsed.stats.rejected[0]?.reason, "no_internship_signal");
});

const bytedanceSource: CompanySourceConfig = {
  id: "src-bytedance",
  companyId: "co-bytedance",
  companySlug: "bytedance",
  companyName: "ByteDance",
  sourceType: "bytedance",
  adapterKey: "bytedance-careers",
  sourceUrl: "https://jobs.bytedance.com/en/position",
  boardToken: "intern,software engineer intern",
};

const tiktokSource: CompanySourceConfig = {
  id: "src-tiktok",
  companyId: "co-tiktok",
  companySlug: "tiktok",
  companyName: "TikTok",
  sourceType: "bytedance",
  adapterKey: "bytedance-careers-tiktok",
  sourceUrl: "https://lifeattiktok.com/early-careers",
  boardToken: "TikTok intern,recommendation intern",
};

test("resolveByteDanceBoard parses locale and search queries for ByteDance", () => {
  const board = resolveByteDanceBoard(bytedanceSource);
  assert.equal(board.locale, "en");
  assert.equal(board.acceptLanguage, "en-US");
  assert.equal(board.scope, "bytedance");
  assert.deepEqual(board.searchQueries, ["intern", "software engineer intern"]);
});

test("resolveByteDanceBoard uses TikTok search queries and lifeattiktok locale", () => {
  const board = resolveByteDanceBoard(tiktokSource);
  assert.equal(board.locale, "en");
  assert.equal(board.scope, "tiktok");
  assert.deepEqual(board.searchQueries, ["TikTok intern", "recommendation intern"]);
});

test("formatByteDanceLocations walks city_info parent chain", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/bytedance-swe-intern.json"),
      "utf8",
    ),
  );
  const job = fixture.data.job_post_list[0];
  const locations = formatByteDanceLocations(job);
  assert.equal(locations[0], "San Jose, California, United States of America");
});

test("isByteDanceListCandidate accepts Intern recruit_type", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/bytedance-swe-intern.json"),
      "utf8",
    ),
  );
  const job = fixture.data.job_post_list[0];
  assert.equal(isByteDanceListCandidate(job), true);
});

test("parseByteDanceJobs keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/bytedance-swe-intern.json"),
      "utf8",
    ),
  );
  const job = fixture.data.job_post_list[0];
  const board = resolveByteDanceBoard(bytedanceSource);
  const parsed = parseByteDanceJobs([{ job, datePosted: null }], bytedanceSource, board, 1);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer Intern/i);
  assert.equal(
    parsed.roles[0].postingUrl,
    buildByteDancePostingUrl(board, job.id),
  );
  assert.match(parsed.roles[0].location ?? "", /San Jose/i);
});

test("parseByteDanceSearchQueries falls back to ByteDance defaults when board token missing", () => {
  const queries = parseByteDanceSearchQueries({ ...bytedanceSource, boardToken: null });
  assert.ok(queries.includes("intern"));
  assert.ok(queries.includes("software engineer intern"));
});

test("isByteDanceTikTokScopedJob accepts TikTok and Shop roles, rejects PICO-only", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/bytedance-swe-intern.json"),
      "utf8",
    ),
  );
  const tiktokJob = fixture.data.job_post_list[0];
  assert.equal(isByteDanceTikTokScopedJob(tiktokJob), true);

  const picoJob = {
    ...tiktokJob,
    title: "3D Graphics Engineer Intern (PICO Foundation) - 2026 Summer (BS/MS)",
    description: "Build VR experiences for PICO headsets.",
    requirement: "",
  };
  assert.equal(isByteDanceTikTokScopedJob(picoJob), false);
});

test("parseByteDanceJobs uses lifeattiktok URLs for TikTok company", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/bytedance-swe-intern.json"),
      "utf8",
    ),
  );
  const job = {
    ...fixture.data.job_post_list[0],
    description: `${fixture.data.job_post_list[0].description}\nTikTok engineering internship.`,
  };
  const board = resolveByteDanceBoard(tiktokSource);
  const parsed = parseByteDanceJobs([{ job, datePosted: null }], tiktokSource, board, 1);

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].postingUrl, `https://lifeattiktok.com/search/${job.id}`);
});

test("parseByteDanceJobs uses current joinbytedance URLs for ByteDance company", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/bytedance-swe-intern.json"),
      "utf8",
    ),
  );
  const job = fixture.data.job_post_list[0];
  const board = resolveByteDanceBoard(bytedanceSource);
  const parsed = parseByteDanceJobs([{ job, datePosted: null }], bytedanceSource, board, 1);

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].postingUrl, `https://joinbytedance.com/search/${job.id}`);
});

test("readByteDanceJobDatePosted accepts future API timestamp fields", () => {
  assert.equal(
    readByteDanceJobDatePosted({
      id: "1",
      title: "Software Engineer Intern",
      publish_time: 1_779_580_800,
    } as never),
    "2026-05-24T00:00:00.000Z",
  );
  assert.equal(
    extractByteDanceDetailDatePosted('{"datePosted":"2026-05-25T12:00:00Z"}'),
    "2026-05-25T12:00:00.000Z",
  );
});

test("parseLifeAtTikTokSearchHtml extracts title and TikTok description from RSC payload", () => {
  const html = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/lifeattiktok-recommendation-intern.html"),
    "utf8",
  );
  const job = parseLifeAtTikTokSearchHtml("7534878965941766408", html);
  assert.ok(job);
  assert.match(job?.title ?? "", /Recommendation Infrastructure/i);
  assert.match(job?.description ?? "", /TikTok's recommendation products/i);
  assert.match(job?.requirement ?? "", /Minimum qualifications/i);
});

test("parseGoogleJobs rejects generic CapitalG portfolio listings", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/google-intern-us.json"),
      "utf8",
    ),
  );
  const portfolioJob = fixture.jobs.find((job: unknown[]) =>
    String(job[1]).includes("CapitalG Portfolio"),
  );
  assert.ok(portfolioJob);

  const parsed = parseGoogleJobs([portfolioJob], googleSource);
  assert.equal(parsed.roles.length, 0);
  assert.equal(parsed.stats.rejected[0]?.reason, "no_internship_signal");
});

const janeStreetSource: CompanySourceConfig = {
  id: "src-jane-street",
  companyId: "co-jane-street",
  companySlug: "jane-street",
  companyName: "Jane Street",
  sourceType: "jane_street",
  adapterKey: "jane-street-greenhouse",
  sourceUrl: "https://www.janestreet.com/join-jane-street/open-roles",
  boardToken: "janestreet",
};

test("parseJaneStreetEmploymentMetadata reads Employment Type and Duration", () => {
  const parsed = parseJaneStreetEmploymentMetadata([
    { name: "Employment Type", value: "Fall Co-Op" },
    { name: "Duration", value: "September-December" },
  ]);
  assert.equal(parsed.employmentType, "Fall Co-Op");
  assert.equal(parsed.duration, "September-December");
});

test("inferJaneStreetSeason uses employment metadata before title alone", () => {
  assert.equal(
    inferJaneStreetSeason("Software Engineer", {
      employmentType: "Fall Co-Op",
      duration: "September-December",
    }),
    "Fall",
  );
  assert.equal(
    inferJaneStreetSeason("Tools and Compilers Research and Development", {
      employmentType: "Summer Internship",
      duration: "Flexible",
    }),
    "Summer",
  );
});

test("parseJaneStreetJobs keeps US engineering internships from employment metadata", () => {
  const parsed = parseJaneStreetJobs(
    [
      {
        id: "1",
        title: "Software Engineer",
        absolute_url: "https://job-boards.greenhouse.io/janestreet/jobs/8160791002",
        location: { name: "New York, New York, United States" },
        metadata: [
          { name: "Employment Type", value: "Fall Co-Op" },
          { name: "Duration", value: "September-December" },
        ],
        updated_at: "2026-05-11T15:26:15-04:00",
        content: "Fall co-op program",
      },
      {
        id: "2",
        title: "Tools and Compilers Research and Development",
        absolute_url: "https://job-boards.greenhouse.io/janestreet/jobs/5869205002",
        location: { name: "New York, New York, United States" },
        metadata: [
          { name: "Employment Type", value: "Summer Internship" },
          { name: "Duration", value: "Flexible" },
        ],
      },
      {
        id: "3",
        title: "Quantitative Researcher",
        absolute_url: "https://job-boards.greenhouse.io/janestreet/jobs/3",
        location: { name: "Hong Kong, Hong Kong" },
        metadata: [
          { name: "Employment Type", value: "Winter Internship" },
          { name: "Duration", value: "December-February" },
        ],
      },
      {
        id: "4",
        title: "AML Onboarding Analyst",
        absolute_url: "https://job-boards.greenhouse.io/janestreet/jobs/4",
        location: { name: "New York, New York, United States" },
        metadata: [
          { name: "Employment Type", value: "Full-Time: Experienced" },
          { name: "Duration", value: "Permanent" },
        ],
      },
    ],
    janeStreetSource,
  );

  assert.equal(parsed.roles.length, 3);
  assert.ok(parsed.roles.some((role) => role.season === "Fall"));
  assert.ok(parsed.roles.some((role) => role.season === "Summer"));
  assert.equal(parsed.stats.rejected.some((r) => r.reason === "no_internship_signal"), true);
});

test("parseJaneStreetJobs fixture keeps engineering internships", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const jobs = JSON.parse(readFileSync(join(fixtureDir, "jane-street-greenhouse.json"), "utf8"));
  const parsed = parseJaneStreetJobs(jobs, janeStreetSource);
  assert.equal(parsed.roles.length, 2);
  assert.equal(parsed.roles[0].roleName, "Software Engineer");
  assert.equal(parsed.roles[0].season, "Fall");
});

const appleSource: CompanySourceConfig = {
  id: "src-apple",
  companyId: "co-apple",
  companySlug: "apple",
  companyName: "Apple",
  sourceType: "apple",
  adapterKey: "apple-careers",
  sourceUrl: "https://jobs.apple.com/en-us/search?location=united-states-USA&search=intern",
  boardToken: "en-us",
};

test("parseAppleSearchConfig resolves locale location and search query", () => {
  const config = parseAppleSearchConfig(appleSource.sourceUrl, appleSource.boardToken);
  assert.equal(config.locale, "en-us");
  assert.equal(config.locationSlug, "united-states-USA");
  assert.equal(config.searchQuery, "intern");
  assert.equal(
    buildAppleSearchPageUrl(config, 2),
    "https://jobs.apple.com/en-us/search?location=united-states-USA&search=intern&page=2",
  );
});

test("formatAppleLocations joins city and country", () => {
  const locations = formatAppleLocations({
    id: "x",
    locations: [{ name: "Cupertino", countryName: "United States of America" }],
  });
  assert.equal(locations[0], "Cupertino, United States of America");
});

test("parseAppleJobs keeps engineering internships from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const loader = JSON.parse(readFileSync(join(fixtureDir, "apple-intern-swe.json"), "utf8"));
  const config = parseAppleSearchConfig(appleSource.sourceUrl, appleSource.boardToken);

  const parsed = parseAppleJobs(
    loader.searchResults,
    appleSource,
    config,
    loader.searchResults.length,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Software Engineering Intern");
  assert.match(parsed.roles[0].postingUrl, /jobs\.apple\.com\/en-us\/details\//);
  assert.equal(
    buildApplePostingUrl(config, loader.searchResults[0]),
    parsed.roles[0].postingUrl,
  );
});

const twoSigmaSource: CompanySourceConfig = {
  id: "src-two-sigma",
  companyId: "co-two-sigma",
  companySlug: "two-sigma",
  companyName: "Two Sigma",
  sourceType: "two_sigma",
  adapterKey: "two-sigma-avature",
  sourceUrl: TWO_SIGMA_OPEN_ROLES_URL,
  boardToken: "106",
};

test("resolveTwoSigmaBoard normalizes careers URL and portal id", () => {
  const board = resolveTwoSigmaBoard({
    ...twoSigmaSource,
    sourceUrl: "https://careers.twosigma.com/careers",
    boardToken: null,
  });

  assert.equal(board.openRolesUrl, TWO_SIGMA_OPEN_ROLES_URL);
  assert.equal(board.portalId, "106");
});

test("parseTwoSigmaOpenRolesHtml extracts title location and experience tags", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "two-sigma-openroles-snippet.html"), "utf8");
  const listings = parseTwoSigmaOpenRolesHtml(html);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "AI Research Scientist - Campus Full-Time");
  assert.equal(listings[0].experienceLevel, "Early Careers");
  assert.equal(listings[1].function, "Business Operations");
});

test("shouldPrefetchTwoSigmaDetail targets campus listings", () => {
  assert.equal(
    shouldPrefetchTwoSigmaDetail({
      title: "AI Research Scientist - Campus Full-Time",
      postingUrl: "https://careers.twosigma.com/careers/JobDetail/x/1",
      location: "United States - NY New York",
      function: "Quantitative Research",
      experienceLevel: "Early Careers",
    }),
    true,
  );
  assert.equal(
    shouldPrefetchTwoSigmaDetail({
      title: "Quantitative Researcher",
      postingUrl: "https://careers.twosigma.com/careers/JobDetail/x/2",
      location: "United States - NY New York",
      function: "Quantitative Research",
      experienceLevel: "Early Careers",
    }),
    false,
  );
  assert.equal(
    shouldPrefetchTwoSigmaDetail({
      title: "Fund Accountant",
      postingUrl: "https://careers.twosigma.com/careers/JobDetail/x/3",
      location: "United States - NY New York",
      function: "Finance",
      experienceLevel: "Experienced",
    }),
    false,
  );
});

test("parseTwoSigmaJobDetailFields extracts publish date from detail HTML", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "two-sigma-job-detail-snippet.html"), "utf8");
  const fields = parseTwoSigmaJobDetailFields(html);
  assert.equal(fields.datePosted, "Wed, 02 Apr 2025 00:00:00 +0000");
  assert.match(fields.description, /quantitative investment/i);
});

test("parseTwoSigmaJobs rejects campus full-time roles from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const listing = JSON.parse(readFileSync(join(fixtureDir, "two-sigma-campus.json"), "utf8"));

  const parsed = parseTwoSigmaJobs([listing], twoSigmaSource);

  assert.equal(parsed.roles.length, 0);
  assert.ok(parsed.stats.rejected.some((row) => row.title.includes("Campus Full-Time")));
});

test("parseTwoSigmaJobs rejects campus full-time and business roles from snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "two-sigma-openroles-snippet.html"), "utf8");
  const listings = parseTwoSigmaOpenRolesHtml(html);
  const parsed = parseTwoSigmaJobs(listings, twoSigmaSource);

  assert.equal(parsed.roles.length, 0);
  assert.ok(parsed.stats.rejected.some((row) => row.title.includes("Campus Full-Time")));
  assert.ok(parsed.stats.rejected.some((row) => row.title.includes("Business Development")));
});

const bloombergSource: CompanySourceConfig = {
  id: "src-bloomberg",
  companyId: "co-bloomberg",
  companySlug: "bloomberg",
  companyName: "Bloomberg",
  sourceType: "bloomberg",
  adapterKey: "bloomberg-avature",
  sourceUrl: BLOOMBERG_SEARCH_JOBS_URL,
  boardToken: "4",
};

test("resolveBloombergBoard normalizes SearchJobs URL and portal id", () => {
  const board = resolveBloombergBoard({
    ...bloombergSource,
    sourceUrl: "https://bloomberg.avature.net/careers",
    boardToken: null,
  });

  assert.equal(board.searchJobsUrl, BLOOMBERG_SEARCH_JOBS_URL);
  assert.equal(board.portalId, "4");
});

test("parseBloombergSearchJobsHtml extracts title and list location", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "bloomberg-searchjobs-snippet.html"), "utf8");
  const listings = parseBloombergSearchJobsHtml(html);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Events Internship");
  assert.match(listings[0].location ?? "", /Sao Paulo/i);
  assert.match(listings[1].title, /Senior Software Engineer/);
});

test("shouldPrefetchBloombergDetail targets internship titles", () => {
  assert.equal(
    shouldPrefetchBloombergDetail({
      title: "Technical Support Internship",
      postingUrl: "https://bloomberg.avature.net/careers/JobDetail/x/1",
      location: "Sao Paulo, Brazil",
      businessArea: null,
    }),
    true,
  );
  assert.equal(
    shouldPrefetchBloombergDetail({
      title: "Senior Software Engineer",
      postingUrl: "https://bloomberg.avature.net/careers/JobDetail/x/2",
      location: "New York, United States",
      businessArea: null,
    }),
    false,
  );
});

test("parseBloombergJobDetailFields extracts labeled location and business area", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "bloomberg-intern-detail-snippet.html"), "utf8");
  const fields = parseBloombergJobDetailFields(html);

  assert.equal(fields.location, "Sao Paulo");
  assert.equal(fields.businessArea, "Sales and Client Service");
});

test("parseBloombergJobs keeps US engineering internships from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const listing = JSON.parse(
    readFileSync(join(fixtureDir, "bloomberg-us-swe-intern.json"), "utf8"),
  );

  const parsed = parseBloombergJobs([listing], bloombergSource);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer Intern/i);
  assert.match(parsed.roles[0].location ?? "", /New York/i);
});

test("parseBloombergJobs rejects non-intern and non-US listings from snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "bloomberg-searchjobs-snippet.html"), "utf8");
  const listings = parseBloombergSearchJobsHtml(html);
  const parsed = parseBloombergJobs(listings, bloombergSource);

  assert.equal(parsed.roles.length, 0);
  assert.ok(parsed.stats.rejected.some((row) => row.title === "Events Internship"));
  assert.ok(parsed.stats.rejected.some((row) => row.title.includes("Senior Software Engineer")));
});

const electronicArtsSource: CompanySourceConfig = {
  id: "src-electronic-arts",
  companyId: "co-electronic-arts",
  companySlug: "electronic-arts",
  companyName: "Electronic Arts",
  sourceType: "electronic_arts",
  adapterKey: "electronic-arts-avature",
  sourceUrl: EA_SEARCH_JOBS_URL,
  boardToken: "4",
};

test("resolveElectronicArtsBoard normalizes SearchJobs URL and portal id", () => {
  const board = resolveElectronicArtsBoard({
    ...electronicArtsSource,
    sourceUrl: "https://jobs.ea.com/en_US/careers",
    boardToken: null,
  });

  assert.equal(board.searchJobsUrl, EA_SEARCH_JOBS_URL);
  assert.equal(board.portalId, "4");
});

test("parseElectronicArtsRssFeed extracts titles and normalizes posting URLs", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const xml = readFileSync(join(fixtureDir, "electronic-arts-rss-snippet.xml"), "utf8");
  const listings = parseElectronicArtsRssFeed(xml);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Software Engineer Intern");
  assert.match(listings[0].postingUrl, /\/en_US\/careers\/JobDetail\/Software-Engineer-Intern\/200001/);
});

test("mergeElectronicArtsRssDates enriches HTML listings without replacing existing dates", () => {
  const merged = mergeElectronicArtsRssDates(
    [
      {
        title: "Software Engineer Intern",
        postingUrl: "https://jobs.ea.com/en_US/careers/JobDetail/Software-Engineer-Intern/200001",
        location: "Orlando, United States",
        studioDepartment: null,
      },
      {
        title: "Already Dated Intern",
        postingUrl: "https://jobs.ea.com/en_US/careers/JobDetail/Already-Dated/200002",
        location: "Orlando, United States",
        studioDepartment: null,
        datePosted: "2026-05-01",
      },
    ],
    [
      {
        title: "Software Engineer Intern",
        postingUrl: "https://jobs.ea.com/careers/JobDetail/Software-Engineer-Intern/200001",
        location: null,
        studioDepartment: null,
        datePosted: "Tue, 26 May 2026 00:00:00 +0000",
      },
      {
        title: "Already Dated Intern",
        postingUrl: "https://jobs.ea.com/en_US/careers/JobDetail/Already-Dated/200002",
        location: null,
        studioDepartment: null,
        datePosted: "Tue, 27 May 2026 00:00:00 +0000",
      },
    ],
  );

  assert.equal(merged[0]?.datePosted, "Tue, 26 May 2026 00:00:00 +0000");
  assert.equal(merged[1]?.datePosted, "2026-05-01");
});

test("shouldPrefetchElectronicArtsDetail targets internship titles", () => {
  assert.equal(
    shouldPrefetchElectronicArtsDetail({
      title: "Software Engineer Intern",
      postingUrl: "https://jobs.ea.com/en_US/careers/JobDetail/x/1",
      location: "Redwood City, United States",
      studioDepartment: null,
    }),
    true,
  );
  assert.equal(
    shouldPrefetchElectronicArtsDetail({
      title: "Senior Software Engineer",
      postingUrl: "https://jobs.ea.com/en_US/careers/JobDetail/x/2",
      location: "Redwood City, United States",
      studioDepartment: null,
    }),
    false,
  );
});

test("parseElectronicArtsJobDetailFields extracts Avature publish date", () => {
  const fields = parseElectronicArtsJobDetailFields(`
    <script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-05-26"}</script>
    <article class="article article--details">
      <div class="article__content__view__field__label">Studio/Department</div>
      <div class="article__content__view__field__value">Technology</div>
      <div class="article__content__view__field__label">Description</div>
      <div class="article__content__view__field__value">${"Build software systems. ".repeat(8)}</div>
    </article>
  `);

  assert.equal(fields.datePosted, "2026-05-26");
  assert.equal(fields.studioDepartment, "Technology");
});

test("parseElectronicArtsJobs keeps US intern listing from RSS fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const xml = readFileSync(join(fixtureDir, "electronic-arts-rss-snippet.xml"), "utf8");
  const listings = parseElectronicArtsRssFeed(xml).map((listing) =>
    listing.title.includes("Intern")
      ? { ...listing, location: "Redwood City, California, United States" }
      : listing,
  );
  const parsed = parseElectronicArtsJobs(listings, electronicArtsSource);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Intern/);
});

const deShawSource: CompanySourceConfig = {
  id: "src-de-shaw",
  companyId: "co-de-shaw",
  companySlug: "de-shaw",
  companyName: "D. E. Shaw",
  sourceType: "de_shaw",
  adapterKey: "de-shaw-careers",
  sourceUrl: DE_SHAW_INTERNSHIPS_URL,
  boardToken: "internships",
};

function loadDeShawInternshipsFixtureHtml(): string {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const pageProps = readFileSync(join(fixtureDir, "de-shaw-internships.json"), "utf8");
  const template = readFileSync(join(fixtureDir, "de-shaw-internships.html"), "utf8");
  return template.replace("REPLACE_ME", pageProps);
}

test("resolveDeShawBoard defaults to internships careers URL", () => {
  const board = resolveDeShawBoard({
    ...deShawSource,
    boardToken: null,
    sourceUrl: "https://www.deshaw.com/careers",
  });

  assert.equal(board.pageKey, "internships");
  assert.equal(board.careersPageUrl, DE_SHAW_INTERNSHIPS_URL);
});

test("parseDeShawNextDataHtml and indexDeShawCareerPaths extract listings", () => {
  const html = loadDeShawInternshipsFixtureHtml();
  const pageProps = parseDeShawNextDataHtml(html);
  const pathById = indexDeShawCareerPaths(html);
  const listings = collectDeShawListings(pageProps, pathById);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Proprietary Trading Intern (New York) – Summer 2027");
  assert.match(listings[0].postingUrl, /5731$/);
  assert.equal(listings[0].location, "New York");
});

test("parseDeShawJobs keeps US quant internships and rejects business strategy", () => {
  const html = loadDeShawInternshipsFixtureHtml();
  const pageProps = parseDeShawNextDataHtml(html);
  const listings = collectDeShawListings(pageProps, indexDeShawCareerPaths(html));
  const parsed = parseDeShawJobs(listings, deShawSource);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Trading Intern/);
  assert.equal(parsed.roles[0].season, "Summer");
  assert.ok(
    parsed.stats.rejected.some((row) =>
      row.title.includes("Strategy and Business Development"),
    ),
  );
});

test("parseLeverJobs fixture keeps only engineering US internships", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const jobs = JSON.parse(readFileSync(join(fixtureDir, "palantir-lever.json"), "utf8"));
  const leverSource: CompanySourceConfig = {
    id: "src-palantir",
    companyId: "co-palantir",
    companySlug: "palantir",
    companyName: "Palantir",
    sourceType: "lever",
    adapterKey: "palantir-lever",
    sourceUrl: "https://jobs.lever.co/palantir",
    boardToken: "palantir",
  };

  const parsed = parseLeverJobs(jobs, leverSource);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Forward Deployed Software Engineer/i);
});

const citadelSource: CompanySourceConfig = {
  id: "src-citadel",
  companyId: "co-citadel",
  companySlug: "citadel",
  companyName: "Citadel",
  sourceType: "citadel",
  adapterKey: "citadel-career-sitemap",
  sourceUrl: "https://www.citadel.com/careers/open-opportunities",
  boardToken: "citadel",
};

test("resolveCitadelBoard maps board_token to Yoast career sitemap URL", () => {
  const board = resolveCitadelBoard(citadelSource);
  assert.equal(board.brand, "citadel");
  assert.equal(board.sitemapUrl, `${CITADEL_BRAND_ORIGINS.citadel}/career-sitemap.xml`);

  const securities = resolveCitadelBoard({
    ...citadelSource,
    boardToken: "citadelsecurities",
    sourceUrl: "https://www.citadelsecurities.com/careers/open-opportunities",
  });
  assert.equal(securities.brand, "citadelsecurities");
  assert.equal(
    securities.sitemapUrl,
    `${CITADEL_BRAND_ORIGINS.citadelsecurities}/career-sitemap.xml`,
  );
});

test("parseCitadelSitemapXml extracts career detail URLs and lastmod", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.citadel.com/careers/details/quantitative-research-engineer-phd-intern-us/</loc>
    <lastmod>2026-05-30T08:14:15+00:00</lastmod>
  </url>
  <url>
    <loc>https://www.citadel.com/about/</loc>
  </url>
</urlset>`;
  const entries = parseCitadelSitemapXml(xml);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.slug, "quantitative-research-engineer-phd-intern-us");
  assert.equal(entries[0]?.lastmod, "2026-05-30T08:14:15+00:00");
});

test("humanizeCitadelSlug and inferCitadelLocations derive title and region", () => {
  assert.equal(
    humanizeCitadelSlug("quantitative-research-engineer-phd-intern-us"),
    "Quantitative Research Engineer PhD Intern US",
  );
  assert.deepEqual(inferCitadelLocations("software-engineer-intern-europe"), ["Europe"]);
  assert.deepEqual(inferCitadelLocations("quantitative-research-intern-asia"), [
    "Hong Kong",
    "Singapore",
  ]);
  assert.deepEqual(inferCitadelLocations("quantitative-research-engineer-phd-intern-us"), ["United States"]);
});

test("slugFromPostingUrl parses careers detail slug", () => {
  assert.equal(
    slugFromPostingUrl("https://www.citadel.com/careers/details/software-engineer-intern-europe/"),
    "software-engineer-intern-europe",
  );
});

test("sitemapLastmodPublishDate treats ISO lastmod as low-confidence publish", () => {
  const dates = sitemapLastmodPublishDate("2026-03-01T12:00:00Z");
  assert.equal(isPublishSource(dates.source), true);
  assert.equal(dates.published, "2026-03-01T12:00:00.000Z");
});

test("lockheedRoleDates parses BrassRing lastUpdated day-month-year", () => {
  const dates = lockheedRoleDates("16-Apr-2026");
  assert.ok(scrapedRolePublishedIso({ dates, datePosted: null })?.startsWith("2026-04-16"));
});

test("atlassianListingDates parses portal updatedDate timestamps", () => {
  const dates = atlassianListingDates({
    id: 1,
    title: "Intern",
    portalJobPost: { updatedDate: "2026-03-26 05:29 AM" },
  });
  assert.equal(isPublishSource(dates.source), true);
  assert.ok(dates.published?.startsWith("2026-03-26"));
});

test("parseCitadelSitemapEntries keeps engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/citadel-sitemap-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseCitadelSitemapEntries(fixture.entries, citadelSource);
  assert.equal(parsed.roles.length, 2);
  assert.ok(
    parsed.roles.some((role) => /Quantitative Research Engineer PhD Intern/i.test(role.roleName)),
  );
  assert.equal(parsed.stats.fetched, fixture.entries.length);
});

const metaSource: CompanySourceConfig = {
  id: "src-meta",
  companyId: "co-meta",
  companySlug: "meta",
  companyName: "Meta",
  sourceType: "meta",
  adapterKey: "meta-careers",
  sourceUrl: "https://www.metacareers.com/jobsearch?employment_type=Internship&q=software+engineer+intern",
  boardToken: "software engineer intern,engineer intern",
};

test("buildMetaSearchInput defaults to internship employment type", () => {
  const input = buildMetaSearchInput("software engineer intern");
  assert.equal(input.q, "software engineer intern");
  assert.deepEqual(input.employment_types, ["Internship"]);
  assert.equal(input.results_per_page, "FIFTY");
});

test("parseMetaSearchQueries prefers board_token comma list", () => {
  const queries = parseMetaSearchQueries(metaSource);
  assert.deepEqual(queries, ["software engineer intern", "engineer intern"]);
});

test("buildMetaPostingUrl maps job id to profile detail URL", () => {
  assert.equal(
    buildMetaPostingUrl("2160167211413098"),
    "https://www.metacareers.com/profile/job_details/2160167211413098",
  );
});

test("parseMetaJobPostingJsonLd reads schema.org JobPosting", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/meta-intern.json"),
      "utf8",
    ),
  );
  const html = `<script type="application/ld+json">${JSON.stringify(fixture.detail)}</script>`;
  const parsed = parseMetaJobPostingJsonLd(html);
  assert.equal(parsed?.title, "Research Scientist Intern, Multimodal Contextual AI (PhD)");
  assert.equal(parsed?.employmentType, "Internship");
  assert.deepEqual(formatMetaLocations(parsed!), ["Redmond, WA"]);
});

test("parseMetaJobs keeps US engineering internships from enriched fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/meta-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseMetaJobs(
    [{ summary: fixture.summary, detail: fixture.detail }],
    metaSource,
    3,
  );

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Research Scientist Intern/i);
  assert.match(parsed.roles[0].postingUrl, /metacareers\.com\/profile\/job_details\//);
  assert.equal(parsed.roles[0].location, "Redmond, WA");
});

test("parseMetaJobs rejects permanent and non-US listings from search fixture", () => {
  const search = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../fixtures/scrape/meta-search-response.json",
      ),
      "utf8",
    ),
  );
  const jobs = search.data.job_search_with_featured_jobs_v2.all_jobs.map(
    (summary: { id: string; title?: string; locations?: string[]; teams?: string[]; sub_teams?: string[] }) => ({
      summary,
      detail: null,
    }),
  );

  const parsed = parseMetaJobs(jobs, metaSource, jobs.length);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Research Scientist Intern/i);
  assert.equal(parsed.stats.rejected.length, 2);
  assert.ok(parsed.stats.rejected.some((r) => r.reason === "no_internship_signal"));
});

const uberSource: CompanySourceConfig = {
  id: "src-uber",
  companyId: "co-uber",
  companySlug: "uber",
  companyName: "Uber",
  sourceType: "uber",
  adapterKey: "uber-careers",
  sourceUrl: "https://www.uber.com/careers/list/?team=Engineering&programAndLevel=Internship",
  boardToken: null,
};

test("parseUberSearchFilters reads team and program filters from source URL", () => {
  const filters = parseUberSearchFilters(uberSource.sourceUrl);
  assert.deepEqual(filters.team, ["Engineering"]);
  assert.deepEqual(filters.programAndLevel, ["Internship"]);
});

test("buildUberPostingUrl uses careers list detail path", () => {
  assert.equal(
    buildUberPostingUrl(158901),
    "https://www.uber.com/careers/list/158901/",
  );
});

test("formatUberLocations joins city region and country", () => {
  const job = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/uber-intern.json"),
      "utf8",
    ),
  ).jobs[0];
  const locations = formatUberLocations(job);
  assert.ok(locations.some((loc: string) => /San Francisco/i.test(loc)));
  assert.ok(locations.some((loc: string) => /United States/i.test(loc)));
});

test("isUberListCandidate accepts timeType Intern and rejects internal titles", () => {
  assert.equal(isUberListCandidate({ id: 1, timeType: "Intern", title: "2026 SWE Intern" }), true);
  assert.equal(isUberListCandidate({ id: 2, title: "Manager, Internal Audit" }), false);
});

test("parseUberJobs keeps engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/uber-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseUberJobs(fixture.jobs, uberSource, fixture.jobs.length);
  assert.equal(parsed.roles.length, 2);
  assert.ok(parsed.roles.some((role) => /Software Engineer Intern/i.test(role.roleName)));
  assert.ok(parsed.stats.rejected.some((row) => row.reason === "non_engineering_role"));
});

const teslaSource: CompanySourceConfig = {
  id: "src-tesla",
  companyId: "co-tesla",
  companySlug: "tesla",
  companyName: "Tesla",
  sourceType: "tesla",
  adapterKey: "tesla-careers",
  sourceUrl: "https://www.tesla.com/careers/search/?query=intern&site=US",
  boardToken: "US",
};

test("resolveTeslaBoard reads site and referer from source URL", () => {
  const board = resolveTeslaBoard(teslaSource);
  assert.equal(board.site, "US");
  assert.equal(board.searchQuery, "intern");
  assert.match(board.referer, /site=US/);
});

test("computeTeslaRetryDelayMs honors Retry-After and caps backoff", () => {
  const response = new Response(null, { status: 429, headers: { "retry-after": "12" } });
  assert.equal(parseTeslaRetryAfterMs(response), 12_000);
  assert.equal(computeTeslaRetryDelayMs(0, response), 12_000);
  assert.equal(computeTeslaRetryDelayMs(3), 20_000);
  assert.equal(computeTeslaRetryDelayMs(10), 45_000);
});

test("buildTeslaPostingUrl slugifies title and appends job id", () => {
  const url = buildTeslaPostingUrl({
    id: "259223",
    t: "Internship, Technical Editor, Service Engineering (Summer 2026)",
  });
  assert.equal(
    url,
    "https://www.tesla.com/careers/search/job/internship-technical-editor-service-engineering-summer-2026-259223",
  );
  assert.equal(
    slugifyTeslaTitle("Internship, Software Engineer, AI Data Infrastructure (Fall 2026)"),
    "internship-software-engineer-ai-data-infrastructure-fall-2026",
  );
});

test("isTeslaListCandidate accepts intern titles and intern employment type", () => {
  assert.equal(isTeslaListCandidate({ id: "1", t: "Software Engineer Intern", y: 1 }), true);
  assert.equal(isTeslaListCandidate({ id: "2", t: "Staff Engineer", y: 3 }), true);
  assert.equal(isTeslaListCandidate({ id: "3", t: "Staff Engineer", y: 1 }), false);
});

test("parseTeslaJobs keeps engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/tesla-careers-state-snippet.json"),
      "utf8",
    ),
  );

  const parsed = parseTeslaJobs(fixture.listings, fixture.lookup, teslaSource, fixture.listings.length);

  assert.equal(parsed.roles.length, 4);
  assert.ok(parsed.roles.every((role) => role.postingUrl.includes("tesla.com/careers/search/job/")));
  assert.ok(parsed.stats.rejected.some((row) => row.reason === "non_engineering_role"));
  assert.equal(
    buildTeslaPostingUrl(fixture.listings[0]),
    parsed.roles[0].postingUrl,
  );
});

const salesforceSource: CompanySourceConfig = {
  id: "src-salesforce",
  companyId: "co-salesforce",
  companySlug: "salesforce",
  companyName: "Salesforce",
  sourceType: "salesforce",
  adapterKey: "salesforce-careers-rss",
  sourceUrl: "https://careers.salesforce.com/en/jobs/xml/?rss=true",
  boardToken: "en",
};

test("resolveSalesforceBoard maps locale to RSS export URL", () => {
  const board = resolveSalesforceBoard(salesforceSource);
  assert.equal(board.locale, "en");
  assert.equal(board.rssUrl, buildSalesforceRssUrl("en"));
});

test("formatSalesforceLocation joins city state and country", () => {
  assert.equal(
    formatSalesforceLocation("San Francisco", "California", "United States of America"),
    "San Francisco, California, United States of America",
  );
});

test("parseSalesforceRssXml reads CDATA job fields", () => {
  const xml = `<?xml version="1.0"?><source><job>
    <title><![CDATA[Summer 2027 Intern - Software Engineer]]></title>
    <url><![CDATA[https://careers.salesforce.com/en/jobs/jr340771/summer-2027-intern-software-engineer/]]></url>
    <city><![CDATA[San Francisco]]></city>
    <country><![CDATA[United States of America]]></country>
    <description><![CDATA[<p>Computer Science intern program</p>]]></description>
  </job></source>`;
  const jobs = parseSalesforceRssXml(xml);
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].title, /Software Engineer/i);
});

test("parseSalesforceJobs keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/salesforce-swe-intern.json"),
      "utf8",
    ),
  );

  const parsed = parseSalesforceJobs(fixture.jobs, salesforceSource, fixture.jobs.length);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer/i);
  assert.match(parsed.roles[0].postingUrl, /careers\.salesforce\.com\/en\/jobs\/jr340771\//);
  assert.equal(parsed.roles[0].location, "San Francisco, California, United States of America");
  assert.ok(parsed.stats.rejected.some((row) => row.reason === "non_engineering_role"));
});

const atlassianSource: CompanySourceConfig = {
  id: "src-atlassian",
  companyId: "co-atlassian",
  companySlug: "atlassian",
  companyName: "Atlassian",
  sourceType: "atlassian",
  adapterKey: "atlassian-careers-listings",
  sourceUrl: ATLASSIAN_LISTINGS_API_URL,
  boardToken: null,
};

test("isAtlassianListingsUrl recognizes careers listings endpoint", () => {
  assert.equal(isAtlassianListingsUrl(ATLASSIAN_LISTINGS_API_URL), true);
  assert.equal(isAtlassianListingsUrl("https://www.atlassian.com/company/careers/all-jobs"), false);
});

test("resolveAtlassianBoard defaults to listings API URL", () => {
  const board = resolveAtlassianBoard(atlassianSource);
  assert.equal(board.listingsUrl, ATLASSIAN_LISTINGS_API_URL);
});

test("isAtlassianListCandidate accepts Interns category and rejects internal titles", () => {
  assert.equal(
    isAtlassianListCandidate({ id: 1, title: "Software Engineer Intern, 2026 Summer U.S.", category: "Interns" }),
    true,
  );
  assert.equal(isAtlassianListCandidate({ id: 2, title: "Manager, Internal Audit" }), false);
});

test("buildAtlassianPostingUrl uses atlassian.com careers details path", () => {
  const board = resolveAtlassianBoard(atlassianSource);
  assert.equal(
    buildAtlassianPostingUrl(board, { id: 99901 }),
    "https://www.atlassian.com/company/careers/details/99901",
  );
});

test("parseAtlassianJobs keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/atlassian-careers-listings.json"),
      "utf8",
    ),
  );
  const listings = parseAtlassianListingsResponse(fixture, ATLASSIAN_LISTINGS_API_URL);
  const candidates = listings.filter((listing) => isAtlassianListCandidate(listing));
  const board = resolveAtlassianBoard(atlassianSource);
  const parsed = parseAtlassianJobs(candidates, atlassianSource, board, listings.length);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer Intern/i);
  assert.match(parsed.roles[0].postingUrl, /atlassian\.com\/company\/careers\/details\/99901/);
  assert.ok(formatAtlassianLocations(listings[0]).some((loc) => /United States/i.test(loc)));
  assert.ok(formatAtlassianDescription(listings[0]).includes("Java"));
  assert.equal(parsed.stats.rejected.length, 1);
  assert.equal(parsed.stats.rejected[0]?.reason, "non_engineering_role");
});

const jpmorganSource: CompanySourceConfig = {
  id: "src-jpmorgan",
  companyId: "co-jpmorgan",
  companySlug: "jpmorgan-chase",
  companyName: "JPMorgan Chase",
  sourceType: "jpmorgan_chase",
  adapterKey: "jpmorgan-chase-oracle-ce",
  sourceUrl: JPMORGAN_DEFAULT_CAREERS_URL,
  boardToken: JPMORGAN_DEFAULT_SITE_NUMBER,
};

test("parseJpmorganCareersUrl extracts CX site from Oracle CE URL", () => {
  const parsed = parseJpmorganCareersUrl(JPMORGAN_DEFAULT_CAREERS_URL);
  assert.equal(parsed?.siteNumber, "CX_1001");
  assert.match(parsed?.localePath ?? "", /en\/sites\/CX_1001/);
});

test("resolveJpmorganBoard builds Oracle CE finder strings", () => {
  const board = resolveJpmorganBoard(jpmorganSource);
  assert.equal(board.siteNumber, "CX_1001");
  assert.match(board.careersOrigin, /jpmc\.fa\.oraclecloud\.com/);
  assert.equal(
    buildJpmorganRequisitionsFinder(board, 0),
    "findReqs;siteNumber=CX_1001,facetsList=LOCATIONS;WORK_LOCATIONS;WORKPLACE_TYPES;TITLES;CATEGORIES;ORGANIZATIONS;POSTING_DATES;FLEX_FIELDS,limit=25,offset=0,keyword=intern",
  );
  assert.equal(buildJpmorganDetailsFinder(board, "210800001"), 'ById;Id="210800001",siteNumber=CX_1001');
});

test("buildJpmorganPostingUrl uses Candidate Experience job path", () => {
  const board = resolveJpmorganBoard(jpmorganSource);
  assert.equal(
    buildJpmorganPostingUrl(board, "210800001"),
    "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210800001",
  );
});

test("isJpmorganListCandidate accepts summer analyst and rejects internal audit", () => {
  assert.equal(
    isJpmorganListCandidate({ Title: "2027 Software Engineer Intern - Global Technology" }),
    true,
  );
  assert.equal(
    isJpmorganListCandidate({ Title: "2027 Markets Summer Analyst Program" }),
    true,
  );
  assert.equal(isJpmorganListCandidate({ Title: "Manager, Internal Audit" }), false);
});

test("parseJpmorganJobs keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/jpmorgan-swe-intern.json"),
      "utf8",
    ),
  );

  const board = resolveJpmorganBoard(jpmorganSource);
  const parsed = parseJpmorganPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    jpmorganSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer Intern/i);
  assert.equal(
    parsed.roles[0].postingUrl,
    buildJpmorganPostingUrl(board, fixture.summary.Id),
  );
  assert.ok(formatJpmorganLocations(fixture.summary, fixture.detail).some((loc) => /Jersey City/i.test(loc)));
  assert.ok(formatJpmorganDescription(fixture.summary, fixture.detail).includes("Java"));
});

const goldmanSource: CompanySourceConfig = {
  id: "src-goldman",
  companyId: "co-goldman",
  companySlug: "goldman-sachs",
  companyName: "Goldman Sachs",
  sourceType: "goldman_sachs",
  adapterKey: "goldman-sachs-oracle-ce",
  sourceUrl: GOLDMAN_DEFAULT_CAREERS_URL,
  boardToken: GOLDMAN_DEFAULT_SITE_NUMBER,
};

test("parseGoldmanCareersUrl accepts Higher campus URL", () => {
  const parsed = parseGoldmanCareersUrl(GOLDMAN_DEFAULT_CAREERS_URL);
  assert.equal(parsed?.siteNumber, "CX_3001");
  assert.equal(parsed?.careersOrigin, GOLDMAN_DEFAULT_CAREERS_URL);
});

test("resolveGoldmanBoard builds Oracle CE finder strings", () => {
  const board = resolveGoldmanBoard(goldmanSource);
  assert.equal(board.siteNumber, "CX_3001");
  assert.equal(
    buildGoldmanRequisitionsFinder(board, 0),
    "findReqs;siteNumber=CX_3001,facetsList=LOCATIONS;WORK_LOCATIONS;WORKPLACE_TYPES;TITLES;CATEGORIES;ORGANIZATIONS;POSTING_DATES;FLEX_FIELDS,limit=25,offset=0,keyword=intern",
  );
  assert.equal(buildGoldmanDetailsFinder(board, "164510"), 'ById;Id="164510",siteNumber=CX_3001');
});

test("buildGoldmanPostingUrl uses Higher role path", () => {
  assert.equal(buildGoldmanPostingUrl("164510"), "https://higher.gs.com/roles/164510");
});

test("isGoldmanListCandidate accepts summer analyst and rejects internal audit", () => {
  assert.equal(
    isGoldmanListCandidate({ Title: "2027 | Americas | New York | Engineering | Summer Analyst" }),
    true,
  );
  assert.equal(
    isGoldmanListCandidate({ Title: "2026 | Americas | Sao Paulo | Controllers | Seasonal/Off Cycle Internship" }),
    true,
  );
  assert.equal(isGoldmanListCandidate({ Title: "Manager, Internal Audit" }), false);
});

test("parseGoldmanPostings keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/goldman-sachs-swe-intern.json"),
      "utf8",
    ),
  );

  const board = resolveGoldmanBoard(goldmanSource);
  const parsed = parseGoldmanPostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    goldmanSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer Intern/i);
  assert.equal(parsed.roles[0].postingUrl, buildGoldmanPostingUrl(fixture.summary.Id));
  assert.ok(formatGoldmanLocations(fixture.summary, fixture.detail).some((loc) => /New York/i.test(loc)));
  assert.ok(formatGoldmanDescription(fixture.summary, fixture.detail).includes("Java"));
});

const oracleSource: CompanySourceConfig = {
  id: "src-oracle",
  companyId: "co-oracle",
  companySlug: "oracle",
  companyName: "Oracle",
  sourceType: "oracle",
  adapterKey: "oracle-oracle-ce",
  sourceUrl: ORACLE_DEFAULT_CAREERS_URL,
  boardToken: ORACLE_DEFAULT_SITE_NUMBER,
};

test("parseOracleCareersUrl extracts CX site from Oracle CE URL", () => {
  const parsed = parseOracleCareersUrl(ORACLE_DEFAULT_CAREERS_URL);
  assert.equal(parsed?.siteNumber, "CX_1");
  assert.match(parsed?.localePath ?? "", /en\/sites\/CX_1/);
});

test("parseOracleCareersUrl accepts oracle.com careers URL", () => {
  const parsed = parseOracleCareersUrl("https://www.oracle.com/careers/students-grads/");
  assert.equal(parsed?.siteNumber, "CX_1");
});

test("parseOracleCareersUrl resolves Akamai vanity careers to Fusion CE tenant", () => {
  const parsed = parseOracleCareersUrl("https://jobs.akamai.com/en/sites/CX_1");
  assert.equal(parsed?.siteNumber, "CX_1");
  assert.equal(parsed?.apiOrigin, "https://fa-extu-saasfaprod1.fa.ocs.oraclecloud.com");
  assert.equal(parsed?.careersOrigin, "https://jobs.akamai.com/en/sites/CX_1");
});

test("resolveOracleBoard uses Akamai API origin for requisitions", () => {
  const board = resolveOracleBoard({
    ...oracleSource,
    companySlug: "akamai",
    companyName: "Akamai",
    adapterKey: "akamai-oracle-ce",
    sourceUrl: "https://jobs.akamai.com/en/sites/CX_1",
    boardToken: "CX_1",
  });
  assert.match(board.requisitionsUrl, /fa-extu-saasfaprod1\.fa\.ocs\.oraclecloud\.com/);
  assert.equal(board.careersOrigin, "https://jobs.akamai.com/en/sites/CX_1");
  assert.equal(
    buildOraclePostingUrl(board, "12345"),
    "https://jobs.akamai.com/en/sites/CX_1/job/12345",
  );
});

test("resolveOracleBoard builds Oracle CE finder strings", () => {
  const board = resolveOracleBoard(oracleSource);
  assert.equal(board.siteNumber, "CX_1");
  assert.match(board.careersOrigin, /eeho\.fa\.us2\.oraclecloud\.com/);
  assert.equal(
    buildOracleRequisitionsFinder(board, 0),
    "findReqs;siteNumber=CX_1,facetsList=LOCATIONS;WORK_LOCATIONS;WORKPLACE_TYPES;TITLES;CATEGORIES;ORGANIZATIONS;POSTING_DATES;FLEX_FIELDS,limit=25,offset=0,keyword=intern",
  );
  assert.equal(buildOracleDetailsFinder(board, "334325"), 'ById;Id="334325",siteNumber=CX_1');
});

test("buildOraclePostingUrl uses Candidate Experience job path", () => {
  const board = resolveOracleBoard(oracleSource);
  assert.equal(
    buildOraclePostingUrl(board, "334325"),
    "https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/334325",
  );
});

test("isOracleListCandidate accepts software engineer intern and rejects internal audit", () => {
  assert.equal(
    isOracleListCandidate({ Title: "OCI Software Engineer Intern - OVIP" }),
    true,
  );
  assert.equal(isOracleListCandidate({ Title: "Student / Intern" }), true);
  assert.equal(isOracleListCandidate({ Title: "Manager, Internal Audit" }), false);
});

test("parseOraclePostings keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/oracle-swe-intern.json"),
      "utf8",
    ),
  );

  const board = resolveOracleBoard(oracleSource);
  const parsed = parseOraclePostings(
    [{ summary: fixture.summary, detail: fixture.detail }],
    oracleSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer Intern/i);
  assert.equal(parsed.roles[0].postingUrl, buildOraclePostingUrl(board, fixture.summary.Id));
  assert.ok(formatOracleLocations(fixture.summary, fixture.detail).some((loc) => /Seattle/i.test(loc)));
  assert.ok(formatOracleDescription(fixture.summary, fixture.detail).includes("Java"));
});

const linkedinSource: CompanySourceConfig = {
  id: "src-linkedin",
  companyId: "co-linkedin",
  companySlug: "linkedin",
  companyName: "LinkedIn",
  sourceType: "linkedin",
  adapterKey: "linkedin-jobs-guest",
  sourceUrl:
    "https://www.linkedin.com/jobs/search/?f_C=1337&location=United%20States",
  boardToken: LINKEDIN_DEFAULT_COMPANY_IDS,
};

test("resolveLinkedInBoard parses company ids and search location", () => {
  const board = resolveLinkedInBoard(linkedinSource);
  assert.equal(board.companyIds.length, 6);
  assert.equal(board.defaultLocation, "United States");
  assert.match(
    buildLinkedInSearchUrl(board, "software engineer intern", 0),
    /keywords=software\+engineer\+intern/,
  );
});

test("parseLinkedInSearchSummaries extracts job ids from search HTML", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/linkedin-intern-swe.json"),
      "utf8",
    ),
  );
  const summaries = parseLinkedInSearchSummaries(fixture.searchHtmlSnippet);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].jobId, "4400000001");
  assert.equal(shouldPrefetchLinkedInDetail(summaries[0]), true);
});

test("parseLinkedInJobPostingHtml reads guest posting fields", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/linkedin-intern-swe.json"),
      "utf8",
    ),
  );
  const detail = parseLinkedInJobPostingHtml(fixture.detailHtmlSnippet, fixture.jobId);
  assert.ok(detail);
  assert.match(detail.title, /Software Engineer Intern/i);
  assert.equal(detail.location, "Sunnyvale, CA");
  assert.equal(detail.employmentType, "Internship");
});

test("parseLinkedInJobs keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/linkedin-intern-swe.json"),
      "utf8",
    ),
  );
  const detail = parseLinkedInJobPostingHtml(fixture.detailHtmlSnippet, fixture.jobId);
  assert.ok(detail);
  const parsed = parseLinkedInJobs([detail], linkedinSource, 1);
  assert.equal(parsed.roles.length, 1);
  assert.equal(
    parsed.roles[0].postingUrl,
    buildLinkedInPostingUrl(fixture.jobId, detail.title),
  );
  assert.equal(parsed.roles[0].season, "Summer");
});

test("parseLinkedInSearchJobIds dedupes urn and path patterns", () => {
  const html =
    'data-entity-urn="urn:li:jobPosting:1" /jobs/view/foo-at-linkedin-2 urn:li:jobPosting:1';
  assert.deepEqual(parseLinkedInSearchJobIds(html).sort(), ["1", "2"]);
});

const intuitSource: CompanySourceConfig = {
  id: "src-intuit",
  companyId: "co-intuit",
  companySlug: "intuit",
  companyName: "Intuit",
  sourceType: "intuit",
  adapterKey: "intuit-talentbrew",
  sourceUrl: INTUIT_DEFAULT_SEARCH_URL,
  boardToken: "internship",
};

test("resolveIntuitBoard normalizes TalentBrew search URL and keyword", () => {
  const board = resolveIntuitBoard({
    ...intuitSource,
    sourceUrl: "https://jobs.intuit.com/search-jobs?k=intern&l=&listFilterMode=1",
    boardToken: null,
  });

  assert.equal(board.searchKeyword, "intern");
  assert.match(board.searchUrl, /k=intern/);
  assert.equal(board.careersOrigin, INTUIT_CAREERS_ORIGIN);
});

test("parseIntuitSearchJobsHtml extracts title and list location", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "intuit-search-snippet.html"), "utf8");
  const listings = parseIntuitSearchJobsHtml(html, INTUIT_CAREERS_ORIGIN);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Legal Intern");
  assert.match(listings[0].location ?? "", /Mountain View/i);
  assert.match(listings[0].postingUrl, /legal-intern/);
});

test("shouldPrefetchIntuitDetail prefetches all listings for internship keyword", () => {
  assert.equal(
    shouldPrefetchIntuitDetail(
      {
        title: "Staff Product Manager",
        postingUrl: "https://jobs.intuit.com/job/x",
        location: "Mountain View, California",
        category: null,
      },
      "internship",
    ),
    true,
  );
  assert.equal(
    shouldPrefetchIntuitDetail(
      {
        title: "Staff Product Manager",
        postingUrl: "https://jobs.intuit.com/job/x",
        location: "Mountain View, California",
        category: null,
      },
      "software engineer",
    ),
    false,
  );
});

test("parseIntuitJobDetailFields extracts category, location, and description", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "intuit-legal-intern-detail-snippet.html"), "utf8");
  const fields = parseIntuitJobDetailFields(html);

  assert.match(fields.category ?? "", /Internship/i);
  assert.match(fields.location ?? "", /Mountain View/i);
  assert.ok(fields.description.includes("LCPO"));
});

test("parseIntuitJobs keeps US engineering internships from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const listing = JSON.parse(readFileSync(join(fixtureDir, "intuit-swe-intern.json"), "utf8"));

  const parsed = parseIntuitJobs([listing], intuitSource);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer Intern/i);
  assert.match(parsed.roles[0].location ?? "", /Mountain View/i);
});

test("parseIntuitJobs rejects non-engineering listings from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "intuit-search-snippet.html"), "utf8");
  const listings = parseIntuitSearchJobsHtml(html, INTUIT_CAREERS_ORIGIN);
  const parsed = parseIntuitJobs(listings, intuitSource);

  assert.equal(parsed.roles.length, 0);
  assert.ok(parsed.stats.rejected.some((row) => row.title === "Legal Intern"));
});

const citigroupSource: CompanySourceConfig = {
  id: "src-citigroup",
  companyId: "co-citigroup",
  companySlug: "citigroup",
  companyName: "Citigroup",
  sourceType: "citigroup",
  adapterKey: "citigroup-talentbrew",
  sourceUrl: CITIGROUP_DEFAULT_SEARCH_URL,
  boardToken: "intern",
};

test("resolveCitigroupBoard normalizes TalentBrew search URL and keyword", () => {
  const board = resolveCitigroupBoard({
    ...citigroupSource,
    sourceUrl: "https://jobs.citi.com/search-jobs?k=intern&l=&listFilterMode=1",
    boardToken: null,
  });

  assert.equal(board.searchKeyword, "intern");
  assert.match(board.searchUrl, /k=intern/);
  assert.equal(board.careersOrigin, CITIGROUP_CAREERS_ORIGIN);
  assert.equal(board.orgId, "287");
});

test("parseCitigroupSearchJobsHtml extracts title and list location", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "citigroup-search-snippet.html"), "utf8");
  const listings = parseCitigroupSearchJobsHtml(html, CITIGROUP_CAREERS_ORIGIN);

  assert.equal(listings.length, 2);
  assert.match(listings[0].title, /Markets/i);
  assert.match(listings[0].location ?? "", /New York/i);
  assert.match(listings[0].postingUrl, /markets-sales-and-trading/);
});

test("shouldPrefetchCitigroupDetail prefetches all listings for intern keyword", () => {
  assert.equal(
    shouldPrefetchCitigroupDetail(
      {
        title: "Staff Product Manager",
        postingUrl: "https://jobs.citi.com/job/x/287/1",
        location: "New York, New York, United States",
        category: null,
      },
      "intern",
    ),
    true,
  );
  assert.equal(
    shouldPrefetchCitigroupDetail(
      {
        title: "Staff Product Manager",
        postingUrl: "https://jobs.citi.com/job/x/287/1",
        location: "New York, New York, United States",
        category: null,
      },
      "software engineer",
    ),
    false,
  );
});

test("parseCitigroupJobDetailFields extracts category, location, and description", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(
    join(fixtureDir, "citigroup-tech-summer-analyst-detail-snippet.html"),
    "utf8",
  );
  const fields = parseCitigroupJobDetailFields(html);

  assert.match(fields.category ?? "", /Technology/i);
  assert.match(fields.location ?? "", /New York/i);
  assert.ok(fields.description.includes("Java"));
  assert.match(fields.title ?? "", /Software Development/i);
});

test("parseCitigroupJobs keeps US engineering internships from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const listing = JSON.parse(
    readFileSync(join(fixtureDir, "citigroup-tech-summer-analyst.json"), "utf8"),
  );

  const parsed = parseCitigroupJobs([listing], citigroupSource);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Development/i);
  assert.match(parsed.roles[0].location ?? "", /New York/i);
});

test("parseCitigroupJobs rejects non-engineering listings from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "citigroup-search-snippet.html"), "utf8");
  const listings = parseCitigroupSearchJobsHtml(html, CITIGROUP_CAREERS_ORIGIN);
  const parsed = parseCitigroupJobs(listings, citigroupSource);

  assert.equal(parsed.roles.length, 0);
  assert.ok(parsed.stats.rejected.some((row) => row.title.includes("Markets")));
  assert.ok(parsed.stats.rejected.some((row) => row.title.includes("Corporate Banking")));
});

const l3harrisSource: CompanySourceConfig = {
  id: "src-l3harris",
  companyId: "co-l3harris",
  companySlug: "l3harris",
  companyName: "L3Harris",
  sourceType: "l3harris",
  adapterKey: "l3harris-talentbrew",
  sourceUrl: L3HARRIS_DEFAULT_SEARCH_URL,
  boardToken: "intern",
};

test("resolveL3HarrisBoard normalizes TalentBrew search URL and keyword", () => {
  const board = resolveL3HarrisBoard({
    ...l3harrisSource,
    sourceUrl: "https://careers.l3harris.com/en/search-jobs?k=internship&l=&listFilterMode=1",
    boardToken: "internship",
  });
  assert.equal(board.careersOrigin, L3HARRIS_CAREERS_ORIGIN);
  assert.equal(board.searchKeyword, "internship");
  assert.match(board.searchUrl, /search-jobs/);
});

test("parseL3HarrisSearchJobsHtml extracts listings from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "l3harris-search-snippet.html"), "utf8");
  const listings = parseL3HarrisSearchJobsHtml(html, L3HARRIS_CAREERS_ORIGIN);
  assert.equal(listings.length, 2);
  assert.match(listings[0].postingUrl, /hr-business-partner-intern/);
  assert.equal(listings[1].title, "Embedded Software Engineering Intern");
});

test("shouldPrefetchL3HarrisDetail prefetches when keyword is intern", () => {
  assert.equal(
    shouldPrefetchL3HarrisDetail(
      {
        title: "Assembly C",
        postingUrl: "https://careers.l3harris.com/en/job/x",
        location: null,
        category: null,
      },
      "intern",
    ),
    true,
  );
});

test("parseL3HarrisJobDetailFields reads title location and JSON-LD date", () => {
  const html = `<h2 class="job-title-heading">Embedded Software Engineering Intern</h2>
    <p class="ajd_header__location">Ottawa, Canada</p>
    <script type="application/ld+json">{"datePosted":"2026-5-28"}</script>
    <div class="ats-description"><div class="desc"><p>Software intern role.</p></div></div>
    <div class="qualifications"></div>`;
  const fields = parseL3HarrisJobDetailFields(html);
  assert.equal(fields.title, "Embedded Software Engineering Intern");
  assert.match(fields.location ?? "", /Ottawa/i);
  assert.match(fields.description, /intern role/i);
  assert.equal(fields.datePosted, "2026-5-28");
});

test("parseL3HarrisJobs filters non-engineering listings from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "l3harris-search-snippet.html"), "utf8");
  const listings = parseL3HarrisSearchJobsHtml(html, L3HARRIS_CAREERS_ORIGIN);
  const parsed = parseL3HarrisJobs(listings, l3harrisSource);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Embedded Software Engineering Intern/);
});

const armSource: CompanySourceConfig = {
  id: "src-arm",
  companyId: "co-arm",
  companySlug: "arm",
  companyName: "Arm",
  sourceType: "arm",
  adapterKey: "arm-talentbrew",
  sourceUrl: ARM_DEFAULT_SEARCH_URL,
  boardToken: "intern",
};

test("resolveArmBoard normalizes TalentBrew search URL and keyword", () => {
  const board = resolveArmBoard({
    ...armSource,
    sourceUrl: "https://careers.arm.com/search-jobs?k=internship&l=&listFilterMode=1",
    boardToken: "internship",
  });
  assert.equal(board.careersOrigin, ARM_CAREERS_ORIGIN);
  assert.equal(board.searchKeyword, "internship");
  assert.match(board.searchUrl, /search-jobs/);
});

test("parseArmSearchJobsHtml extracts listings from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "arm-search-snippet.html"), "utf8");
  const listings = parseArmSearchJobsHtml(html, ARM_CAREERS_ORIGIN);
  assert.equal(listings.length, 2);
  assert.match(listings[0].postingUrl, /software-engineer-intern/);
  assert.equal(listings[1].title, "Intern, System IP Engineering");
});

test("buildArmPostingUrl requires org and job id path", () => {
  assert.match(
    buildArmPostingUrl(ARM_CAREERS_ORIGIN, "/job/austin/intern/33099/123") ?? "",
    /careers\.arm\.com\/job\/austin\/intern\/33099\/123/,
  );
  assert.equal(buildArmPostingUrl(ARM_CAREERS_ORIGIN, "/not-a-job"), null);
});

test("shouldPrefetchArmDetail prefetches when keyword is intern", () => {
  assert.equal(
    shouldPrefetchArmDetail(
      {
        title: "Staff Engineer",
        postingUrl: "https://careers.arm.com/job/x",
        location: null,
        category: null,
      },
      "intern",
    ),
    true,
  );
});

test("parseArmJobDetailFields reads title location and JSON-LD date", () => {
  const html = `<h1 class="ajd_header__job-title pb-2">Software Engineer Intern</h1>
    <span class="job-location job-info"><b>Location</b> Austin, Texas </span>
    <script type="application/ld+json">{"datePosted":"2026-5-28"}</script>
    <div class="ats-description"><div class="desc"><p>Software intern role.</p></div></div>
    </div>`;
  const fields = parseArmJobDetailFields(html);
  assert.equal(fields.title, "Software Engineer Intern");
  assert.match(fields.location ?? "", /Austin/i);
  assert.match(fields.description, /intern role/i);
  assert.equal(fields.datePosted, "2026-5-28");
});

test("parseArmJobs keeps US intern and rejects non-US from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "arm-search-snippet.html"), "utf8");
  const listings = parseArmSearchJobsHtml(html, ARM_CAREERS_ORIGIN);
  const parsed = parseArmJobs(listings, armSource);
  assert.ok(parsed.roles.length >= 1);
  assert.ok(parsed.roles.some((role) => /Software Engineer Intern/i.test(role.roleName)));
});

const synopsysSource: CompanySourceConfig = {
  id: "src-synopsys",
  companyId: "co-synopsys",
  companySlug: "synopsys",
  companyName: "Synopsys",
  sourceType: "synopsys",
  adapterKey: "synopsys-talentbrew",
  sourceUrl: SYNOPSYS_DEFAULT_SEARCH_URL,
  boardToken: "intern",
};

test("resolveSynopsysBoard normalizes TalentBrew search keywords", () => {
  const board = resolveSynopsysBoard({
    ...synopsysSource,
    boardToken: "internship",
    sourceUrl: "https://careers.synopsys.com/search-jobs?k=internship&l=&listFilterMode=1",
  });
  assert.equal(board.searchKeyword, "internship");
  assert.equal(board.orgId, "44408");
});

test("parseSynopsysSearchJobsHtml extracts listings from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "synopsys-search-snippet.html"), "utf8");
  const listings = parseSynopsysSearchJobsHtml(html, SYNOPSYS_CAREERS_ORIGIN);
  assert.equal(listings.length, 2);
  assert.equal(listings[0]?.title, "AI/ML Engineering Internship");
  assert.match(listings[0]?.location ?? "", /Sunnyvale/i);
});

test("parseSynopsysJobDetailFields extracts detail fields from snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "synopsys-detail-snippet.html"), "utf8");
  const fields = parseSynopsysJobDetailFields(html);
  assert.equal(fields.title, "AI/ML Engineering Internship");
  assert.match(fields.location ?? "", /Sunnyvale/i);
  assert.equal(fields.category, "Interns/Temp");
  assert.match(fields.description, /internship program/i);
});

test("parseSynopsysJobs keeps US engineering internships from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "synopsys-search-snippet.html"), "utf8");
  const listings = parseSynopsysSearchJobsHtml(html, SYNOPSYS_CAREERS_ORIGIN);
  const parsed = parseSynopsysJobs(listings, synopsysSource);
  assert.equal(parsed.roles.length, 2);
});

test("shouldPrefetchSynopsysDetail prefetches when search keyword is intern", () => {
  assert.equal(
    shouldPrefetchSynopsysDetail(
      {
        title: "Software Engineer",
        postingUrl: "https://careers.synopsys.com/job/x",
        location: "San Jose, California",
        category: null,
      },
      "intern",
    ),
    true,
  );
});

const baeSystemsSource: CompanySourceConfig = {
  id: "src-bae-systems",
  companyId: "co-bae-systems",
  companySlug: "bae-systems",
  companyName: "BAE Systems",
  sourceType: "bae_systems",
  adapterKey: "bae-systems-phenom",
  sourceUrl: BAE_SYSTEMS_DEFAULT_SEARCH_URL,
  boardToken: "BAE1US",
};

test("resolveBaeSystemsBoard normalizes Phenom search keywords", () => {
  const board = resolveBaeSystemsBoard({
    ...baeSystemsSource,
    sourceUrl: "https://jobs.baesystems.com/global/en/search-results?keywords=internship",
  });
  assert.equal(board.searchKeywords[0], "internship");
  assert.ok(board.searchKeywords.includes("intern"));
});

test("parseBaeSystemsSearchDdo extracts jobs from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "bae-systems-search-snippet.html"), "utf8");
  const ddo = parseBaeSystemsSearchDdo(html);
  assert.ok((ddo?.data?.jobs?.length ?? 0) >= 1);
  assert.ok(isBaeSystemsListCandidate(ddo!.data!.jobs![0]));
});

test("parseBaeSystemsJobs keeps US engineering internships from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "bae-systems-search-snippet.html"), "utf8");
  const ddo = parseBaeSystemsSearchDdo(html)!;
  const jobs = (ddo.data?.jobs ?? []).filter(isBaeSystemsListCandidate);
  const postings = jobs.map((summary) => ({
    summary,
    description: summary.descriptionTeaser ?? "",
  }));
  const parsed = parseBaeSystemsJobs(postings, baeSystemsSource, jobs.length);

  assert.ok(parsed.roles.length >= 1);
  const intern = parsed.roles.find((role) => /Quality Engineering Intern/i.test(role.roleName));
  assert.ok(intern);
  assert.ok(formatBaeSystemsLocations(jobs[0]).some((loc) => /United States/i.test(loc)));
  assert.ok(buildBaeSystemsPostingUrl(jobs[0])?.includes("brassring.com"));
});

const etsySource: CompanySourceConfig = {
  id: "src-etsy",
  companyId: "co-etsy",
  companySlug: "etsy",
  companyName: "Etsy",
  sourceType: "etsy",
  adapterKey: "etsy-clinch",
  sourceUrl: ETSY_DEFAULT_SEARCH_URL,
  boardToken: null,
};

test("resolveEtsyBoard uses careers.etsy.com search URL", () => {
  const board = resolveEtsyBoard(etsySource);
  assert.equal(board.careersOrigin, ETSY_CAREERS_ORIGIN);
  assert.match(board.sitemapUrl, /sitemap\.xml$/);
  assert.match(board.searchUrl, /\/jobs\/search$/);
});

test("parseEtsySitemapJobs extracts postings from sitemap snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const xml = readFileSync(join(fixtureDir, "etsy-sitemap-snippet.xml"), "utf8");
  const listings = parseEtsySitemapJobs(xml, ETSY_CAREERS_ORIGIN);
  assert.ok(listings.length >= 2);
  assert.match(listings[0].postingUrl, /careers\.etsy\.com\/jobs\//);
  assert.match(listings[0].title, /Engineering|Staff|Software/i);
});

test("parseEtsyPostingUrl humanizes slug and location suffix", () => {
  const parsed = parseEtsyPostingUrl(
    "https://careers.etsy.com/jobs/software-engineer-ii-machine-learning-brooklyn-new-york-united-states",
  );
  assert.equal(parsed?.title, "Software Engineer II Machine Learning");
  assert.match(parsed?.location ?? "", /Brooklyn/i);
});

test("parseEtsyJobs rejects non-intern listings from search snippet", () => {
  const listings = [
    {
      postingUrl: "https://careers.etsy.com/jobs/software-engineer-intern-brooklyn-new-york-united-states",
      title: "Software Engineer Intern",
      location: "Brooklyn, New York, United States",
      summary: null,
      datePosted: null,
    },
    {
      postingUrl: "https://careers.etsy.com/jobs/software-engineer-ii-machine-learning-brooklyn-new-york-united-states",
      title: "Software Engineer II Machine Learning",
      location: "Brooklyn, New York, United States",
      summary: null,
      datePosted: null,
    },
  ];
  const parsed = parseEtsyJobs(listings, etsySource);
  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].roleName, "Software Engineer Intern");
  assert.ok(parsed.stats.rejected.some((row) => row.reason === "no_internship_signal"));
});

const shopifySource: CompanySourceConfig = {
  id: "src-shopify",
  companyId: "co-shopify",
  companySlug: "shopify",
  companyName: "Shopify",
  sourceType: "shopify",
  adapterKey: "shopify-careers-feed",
  sourceUrl: SHOPIFY_CAREERS_FEED_URL,
  boardToken: "feed",
};

test("isShopifyFeedUrl accepts careers feed.xml", () => {
  assert.equal(isShopifyFeedUrl(SHOPIFY_CAREERS_FEED_URL), true);
  assert.equal(isShopifyFeedUrl("https://www.shopify.com/careers"), false);
});

test("resolveShopifyBoard defaults to public careers feed", () => {
  const board = resolveShopifyBoard(shopifySource);
  assert.equal(board.feedUrl, SHOPIFY_CAREERS_FEED_URL);
});

test("parseShopifyFeedXml reads CDATA job fields", () => {
  const xml = `<?xml version="1.0"?><source><job><title><![CDATA[Software Engineering Intern]]></title><applyUrl><![CDATA[https://www.shopify.com/careers/intern_abc]]></applyUrl><location><![CDATA[NAMER]]></location></job></source>`;
  const jobs = parseShopifyFeedXml(xml);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Software Engineering Intern");
});

test("isShopifyListCandidate accepts intern titles and rejects internal tools", () => {
  assert.equal(isShopifyListCandidate({ title: "Software Engineering Intern (Americas)" } as never), true);
  assert.equal(isShopifyListCandidate({ title: "Staff Software Engineer - Internal Tools" } as never), false);
});

test("normalizeShopifyPostingUrl strips tracking query params", () => {
  assert.equal(
    normalizeShopifyPostingUrl(
      "https://www.shopify.com/careers/software-engineering-intern_abc?utm_source=linkedin",
    ),
    "https://www.shopify.com/careers/software-engineering-intern_abc",
  );
});

test("parseShopifyListDate parses MM/DD/YYYY feed dates", () => {
  const iso = parseShopifyListDate("05/01/2026");
  assert.ok(iso?.startsWith("2026-05-01"));
});

test("parseShopifyJobs keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/shopify-swe-intern.json"),
      "utf8",
    ),
  );

  const job = {
    partnerJobId: fixture.job.partnerJobId,
    title: fixture.job.title,
    description: fixture.job.description,
    applyUrl: fixture.job.applyUrl,
    location: fixture.job.location,
    workplaceTypes: fixture.job.workplaceTypes,
    experienceLevel: fixture.job.experienceLevel,
    listDate: fixture.job.listDate,
  };

  const parsed = parseShopifyJobs([job], shopifySource, 1);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineering Intern/i);
  assert.equal(
    parsed.roles[0].postingUrl,
    normalizeShopifyPostingUrl(fixture.job.applyUrl),
  );
  assert.ok(formatShopifyLocations(job).some((loc) => /United States/i.test(loc)));
  assert.equal(parsed.roles[0].season, "Summer");
  assert.equal(buildShopifyPostingUrl(job).includes(fixture.job.partnerJobId), true);
});

const netflixSource: CompanySourceConfig = {
  id: "src-netflix",
  companyId: "co-netflix",
  companySlug: "netflix",
  companyName: "Netflix",
  sourceType: "netflix",
  adapterKey: "netflix-phenom",
  sourceUrl: NETFLIX_DEFAULT_SOURCE_URL,
  boardToken: "netflix.com",
};

test("resolveNetflixBoard normalizes careers origin and domain", () => {
  const board = resolveNetflixBoard({
    ...netflixSource,
    sourceUrl: "https://explore.jobs.netflix.net/careers",
    boardToken: null,
  });

  assert.equal(board.domain, "netflix.com");
  assert.equal(board.careersOrigin, "https://explore.jobs.netflix.net");
  assert.ok(board.searchQueries.includes("intern"));
});

test("parseNetflixCareersHtml extracts embedded positions from careers HTML", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "netflix-careers-intern-snippet.html"), "utf8");
  const positions = parseNetflixCareersHtml(html);

  assert.ok(positions.length >= 2);
  assert.ok(positions.some((row) => /PhD Intern/i.test(row.name ?? "")));
});

test("parseNetflixPostings keeps US engineering internships from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const summary = JSON.parse(
    readFileSync(join(fixtureDir, "netflix-phd-intern-listing.json"), "utf8"),
  );
  const detail = JSON.parse(
    readFileSync(join(fixtureDir, "netflix-phd-intern-detail.json"), "utf8"),
  );
  const board = resolveNetflixBoard(netflixSource);

  const parsed = parseNetflixPostings(
    [{ summary, detail }],
    netflixSource,
    board,
    3,
  );

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer PhD Intern/i);
  assert.match(parsed.roles[0].location ?? "", /Los Gatos/i);
  assert.equal(parsed.roles[0].season, "Summer");
  assert.equal(
    buildNetflixPostingUrl(board, summary, detail),
    detail.canonicalPositionUrl,
  );
});

test("parseNetflixPostings rejects non-intern listings", () => {
  const board = resolveNetflixBoard(netflixSource);
  const parsed = parseNetflixPostings(
    [
      {
        summary: {
          id: 1,
          name: "Senior Software Engineer",
          locations: ["Los Gatos,California,United States of America"],
          canonicalPositionUrl: "https://explore.jobs.netflix.net/careers/job/1",
        },
        detail: {
          name: "Senior Software Engineer",
          job_description: "Build distributed systems.",
          locations: ["Los Gatos,California,United States of America"],
        },
      },
    ],
    netflixSource,
    board,
    1,
  );

  assert.equal(parsed.roles.length, 0);
  assert.ok(parsed.stats.rejected.some((row) => row.title === "Senior Software Engineer"));
});

const millenniumSource: CompanySourceConfig = {
  id: "src-millennium",
  companyId: "co-millennium",
  companySlug: "millennium",
  companyName: "Millennium Management",
  sourceType: "millennium",
  adapterKey: "millennium-eightfold-campus",
  sourceUrl: MILLENNIUM_DEFAULT_SOURCE_URL,
  boardToken: "mlp.com",
};

test("resolveMillenniumBoard normalizes Eightfold campus careers URL", () => {
  const board = resolveMillenniumBoard({
    ...millenniumSource,
    sourceUrl: "https://campusjobs.mlp.com/careers",
    boardToken: null,
  });

  assert.equal(board.domain, "mlp.com");
  assert.equal(board.careersOrigin, "https://mlp.eightfold.ai");
  assert.equal(board.microsite, "campus-site");
  assert.ok(board.searchQueries.includes("intern"));
  assert.match(
    buildMillenniumSearchUrl(board, "intern"),
    /microsite=campus-site/,
  );
});

test("parseMillenniumSmartApplyHtml extracts embedded positions", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "millennium-campus-intern-snippet.html"), "utf8");
  const positions = parseMillenniumSmartApplyHtml(html);

  assert.ok(positions.length >= 2);
  assert.ok(positions.some((row) => /Software Engineering Intern/i.test(row.name ?? "")));
});

test("parseMillenniumPostings keeps US engineering internships from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const summary = JSON.parse(
    readFileSync(join(fixtureDir, "millennium-swe-intern-listing.json"), "utf8"),
  );
  const detail = JSON.parse(
    readFileSync(join(fixtureDir, "millennium-swe-intern-detail.json"), "utf8"),
  );
  const board = resolveMillenniumBoard(millenniumSource);

  const parsed = parseMillenniumPostings(
    [{ summary, detail }],
    millenniumSource,
    board,
    2,
  );

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineering Intern/i);
  assert.match(parsed.roles[0].location ?? "", /New York/i);
  assert.equal(parsed.roles[0].season, "Summer");
  assert.equal(
    buildMillenniumPostingUrl(board, summary, detail),
    detail.canonicalPositionUrl,
  );
});

test("parseMillenniumPostings keeps international engineering internships", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const detail = JSON.parse(
    readFileSync(join(fixtureDir, "millennium-trading-intern-detail.json"), "utf8"),
  );
  const board = resolveMillenniumBoard(millenniumSource);
  const summary = {
    id: detail.id,
    name: detail.name,
    locations: detail.locations,
    department: detail.department,
    t_update: detail.t_update,
    canonicalPositionUrl: detail.canonicalPositionUrl,
  };

  const parsed = parseMillenniumPostings([{ summary, detail }], millenniumSource, board, 1);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Trading Intern/i);
});

const ibmSource: CompanySourceConfig = {
  id: "src-ibm",
  companyId: "co-ibm",
  companySlug: "ibm",
  companyName: "IBM",
  sourceType: "ibm",
  adapterKey: "ibm-avature",
  sourceUrl: IBM_SEARCH_JOBS_URL,
  boardToken: "4",
};

test("resolveIbmBoard normalizes intern SearchJobs URL and portal id", () => {
  const board = resolveIbmBoard({
    ...ibmSource,
    sourceUrl: "https://careers.ibm.com/en_US/careers",
    boardToken: null,
  });

  assert.equal(board.searchJobsUrl, IBM_SEARCH_JOBS_URL);
  assert.equal(board.portalId, "4");
  assert.equal(board.locale, "en_US");
});

test("parseIbmSearchJobsHtml extracts title, department, and location", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "ibm-searchjobs-intern-snippet.html"), "utf8");
  const board = resolveIbmBoard(ibmSource);
  const listings = parseIbmSearchJobsHtml(html, board);

  assert.ok(listings.length >= 3);
  const clientEngineering = listings.find((row) => row.title === "Client Engineering Intern");
  assert.ok(clientEngineering);
  assert.equal(clientEngineering?.department, "Sales");
  assert.equal(clientEngineering?.location, "Singapore");
  const applicationDeveloper = listings.find((row) => row.title === "Application Developer Intern");
  assert.ok(applicationDeveloper);
  assert.equal(applicationDeveloper?.location, "Lithuania");
});

test("buildIbmPostingUrl uses careers.ibm.com JobDetail query param", () => {
  const board = resolveIbmBoard(ibmSource);
  assert.equal(
    buildIbmPostingUrl(board, "80863"),
    "https://careers.ibm.com/en_US/careers/JobDetail?jobId=80863",
  );
});

test("parseIbmJobDetailFields reads JSON-LD datePosted", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "ibm-job-detail-snippet.html"), "utf8");
  const fields = parseIbmJobDetailFields(html);
  assert.equal(fields.datePosted, "2026-03-15");
  assert.match(fields.description, /cloud services/i);
});

test("shouldPrefetchIbmDetail targets internship list rows", () => {
  assert.equal(
    shouldPrefetchIbmDetail({
      title: "Application Developer Intern",
      postingUrl: "https://careers.ibm.com/en_US/careers/JobDetail?jobId=1",
      location: "United States",
      department: "Software Engineering",
      employmentType: "Internship",
    }),
    true,
  );
  assert.equal(
    shouldPrefetchIbmDetail({
      title: "Senior Consultant",
      postingUrl: "https://careers.ibm.com/en_US/careers/JobDetail?jobId=2",
      location: "United States",
      department: "Consulting",
      employmentType: "Regular",
    }),
    false,
  );
});

test("parseIbmJobs keeps US engineering internships from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const listing = JSON.parse(readFileSync(join(fixtureDir, "ibm-sre-intern.json"), "utf8"));

  const parsed = parseIbmJobs([listing], ibmSource);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Site Reliability Engineer Intern/i);
  assert.equal(parsed.roles[0].location, "United States");
  assert.match(parsed.roles[0].postingUrl, /jobId=80863/);
});

test("parseIbmJobs keeps engineering internships from search snippet", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const html = readFileSync(join(fixtureDir, "ibm-searchjobs-intern-snippet.html"), "utf8");
  const board = resolveIbmBoard(ibmSource);
  const listings = parseIbmSearchJobsHtml(html, board);
  const parsed = parseIbmJobs(listings, ibmSource);

  assert.ok(parsed.roles.length >= 1);
  assert.ok(parsed.roles.every((role) => /Intern/i.test(role.roleName)));
});

const coinbaseSource: CompanySourceConfig = {
  id: "src-coinbase",
  companyId: "co-coinbase",
  companySlug: "coinbase",
  companyName: "Coinbase",
  sourceType: "coinbase",
  adapterKey: "coinbase-careers-api",
  sourceUrl: COINBASE_DEFAULT_POSITIONS_URL,
  boardToken: COINBASE_DEFAULT_BOARD_TOKEN,
};

test("resolveCoinbaseBoard defaults to coinbase Greenhouse board token", () => {
  const board = resolveCoinbaseBoard({
    ...coinbaseSource,
    boardToken: null,
    sourceUrl: "",
  });

  assert.equal(board.boardToken, "coinbase");
  assert.equal(board.careersOrigin, COINBASE_DEFAULT_POSITIONS_URL);
});

test("buildCoinbasePostingUrl uses coinbase.com careers positions path", () => {
  assert.equal(
    buildCoinbasePostingUrl(7123456),
    "https://www.coinbase.com/careers/positions/7123456",
  );
});

test("parseCoinbaseJobs keeps US engineering internships from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/coinbase-swe-intern.json"),
      "utf8",
    ),
  );

  const departments = parseCoinbaseCareersResponse(fixture, "https://api.coinbase.com/v2/careers");
  const merged = mergeCoinbaseDepartmentsWithMetadata(departments, new Map());
  const jobs = flattenCoinbaseJobs(merged);
  const enriched = jobs.map(({ job, departmentName }) => ({
    job,
    departmentName,
    detailContent: null,
  }));
  const parsed = parseCoinbaseJobs(enriched, coinbaseSource, jobs.length);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer Intern/i);
  assert.match(parsed.roles[0].postingUrl, /coinbase\.com\/careers\/positions\/7123456/);
  assert.match(parsed.roles[0].location ?? "", /San Francisco/i);
  assert.ok(parsed.stats.rejected.length >= 2);
});

const lockheedMartinSource: CompanySourceConfig = {
  id: "src-lockheed-martin",
  companyId: "co-lockheed-martin",
  companySlug: "lockheed-martin",
  companyName: "Lockheed Martin",
  sourceType: "lockheed_martin",
  adapterKey: "lockheed-martin-brassring",
  sourceUrl: LOCKHEED_MARTIN_CAREERS_URL,
  boardToken: "25037:5010",
};

test("resolveLockheedMartinBoard parses partner and site from board token", () => {
  const board = resolveLockheedMartinBoard(lockheedMartinSource);
  assert.equal(board.partnerId, "25037");
  assert.equal(board.siteId, "5010");
  assert.match(board.careersHomeUrl, /partnerid=25037/);
  assert.match(board.careersHomeUrl, /siteid=5010/);
});

test("buildLockheedMartinPostingUrl uses BrassRing JobDetails preload URL", () => {
  const board = resolveLockheedMartinBoard(lockheedMartinSource);
  assert.equal(
    buildLockheedMartinPostingUrl(board, "845972"),
    "https://sjobs.brassring.com/TGnewUI/Search/Home/HomeWithPreLoad?partnerid=25037&siteid=5010&PageType=JobDetails&jobid=845972",
  );
});

test("parseBrassRingMatchedJobsResponse reads list rows from fixture", () => {
  const fixture = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../fixtures/scrape/lockheed-martin-matched-jobs-intern-tech.json",
      ),
      "utf8",
    ),
  );

  const summaries = parseBrassRingMatchedJobsResponse(fixture);
  assert.ok(summaries.length >= 2);
  assert.ok(summaries.some((row) => /Returnship/i.test(row.title)));
});

test("isLockheedListCandidate accepts returnship and rejects unrelated engineers", () => {
  assert.equal(
    isLockheedListCandidate({
      reqId: "1",
      title: "Chapter Next Returnship - Software Engineer (Java, C++)",
      state: "Virginia",
      businessArea: null,
      qualificationsSnippet: null,
      jobCode: null,
      program: null,
      lastUpdated: null,
    }),
    true,
  );
  assert.equal(
    isLockheedListCandidate({
      reqId: "2",
      title: "Quality Engineer",
      state: "Texas",
      businessArea: null,
      qualificationsSnippet: null,
      jobCode: null,
      program: null,
      lastUpdated: null,
    }),
    false,
  );
});

test("parseLockheedMartinJobs keeps US engineering returnship from detail fixture", () => {
  const detailFixture = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../fixtures/scrape/lockheed-martin-returnship-detail.json",
      ),
      "utf8",
    ),
  );

  const summary = {
    reqId: "845972",
    title: "Chapter Next Returnship - Software Engineer (Java, C++)",
    state: "Virginia",
    businessArea: "Rotary and Mission Systems",
    qualificationsSnippet: null,
    jobCode: "N90A6:Return to Work Intern Tech",
    program: "Chapter Next Returnship",
    lastUpdated: "16-Apr-2026",
  };

  const detail = parseBrassRingJobDetailResponse(detailFixture, summary);
  const parsed = parseLockheedMartinJobs([detail], lockheedMartinSource, 1);

  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineer/i);
  assert.match(parsed.roles[0].postingUrl, /jobid=845972/);
  assert.match(parsed.roles[0].location ?? "", /Manassas|Virginia/i);
});

test("parseWorkableJobs keeps internship roles from widget payload shape", () => {
  const parsed = parseWorkableJobs(
    [
      {
        title: "Open-Source Machine Learning Engineer Intern - US Remote",
        application_url: "https://apply.workable.com/j/ABC123/apply",
        employment_type: "Intern",
        city: "New York",
        state: "NY",
        country: "United States",
        published_on: "2026-05-29",
      },
      {
        title: "Senior Corporate Counsel",
        application_url: "https://apply.workable.com/j/LEGAL/apply",
        employment_type: "Full-time",
      },
    ],
    {
      companyName: "Hugging Face",
      companySlug: "hugging-face",
      sourceType: "workable",
      adapterKey: "test",
      sourceUrl: "https://apply.workable.com/huggingface",
      boardToken: "huggingface",
      id: "x",
      companyId: "y",
    },
  );

  assert.equal(parsed.stats.fetched, 2);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Machine Learning Engineer/i);
});

test("parseBreezyJobs keeps US engineering interns from portal JSON", () => {
  const parsed = parseBreezyJobs(
    [
      {
        name: "Machine Learning Engineer Intern",
        url: "https://midjourney.breezy.hr/p/ml-intern",
        published_date: "2026-05-01T12:00:00.000Z",
        type: { id: "fullTime", name: "Full-Time" },
        department: "Research",
        location: {
          name: "San Francisco, CA",
          city: "San Francisco",
          country: { id: "US", name: "United States" },
          state: { id: "CA", name: "California" },
        },
      },
      {
        name: "Office Manager",
        url: "https://midjourney.breezy.hr/p/office-manager",
        location: { name: "London, UK", country: { id: "GB", name: "United Kingdom" } },
      },
    ],
    {
      companyName: "Midjourney",
      companySlug: "midjourney",
      sourceType: "breezy",
      adapterKey: "test",
      sourceUrl: "https://midjourney.breezy.hr/",
      boardToken: "midjourney",
      id: "x",
      companyId: "y",
    },
  );

  assert.equal(parsed.stats.fetched, 2);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Machine Learning Engineer Intern/i);
});

test("parseHiringThingListHtml finds intern listings", () => {
  const board = {
    boardOrigin: "https://voloridge-investment-management.hiringthing.com",
    listUrl: "https://voloridge-investment-management.hiringthing.com/",
  };
  const html = `
    <a href="/job/1013126/quantitative-developer-intern-2027">Intern</a>
    <a href="/job/986594/it-support-administrator">IT</a>
  `;
  const jobs = parseHiringThingListHtml(html, board);
  assert.equal(jobs.length, 2);
  const intern = jobs.find((job) => job.jobId === "1013126");
  assert.ok(intern);
  assert.equal(isHiringThingListCandidate(intern!), true);
  assert.equal(isHiringThingListCandidate(jobs[1]!), false);
});

test("parseHiringThingJobDetailHtml reads JSON-LD date, description, and location", () => {
  const detail = parseHiringThingJobDetailHtml(
    `
      <html>
        <head>
          <meta property="og:title" content="Quantitative Developer Intern 2027" />
          <script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-05-25"}</script>
        </head>
        <body>
          <div class="job-location">Jupiter, FL</div>
          <div class="job-description">
            <p>Build research systems for an internship program.</p>
          </div>
        </body>
      </html>
    `,
    { companyName: "Voloridge", companySlug: "voloridge" },
  );

  assert.equal(detail.title, "Quantitative Developer Intern 2027");
  assert.equal(detail.postedOn, "2026-05-25");
  assert.equal(detail.location, "Jupiter, FL");
  assert.match(detail.description, /research systems/i);
});

test("resolvePinpointBoard accepts explicit JSON endpoints", () => {
  const board = resolvePinpointBoard({
    id: "src",
    companyId: "co",
    companySlug: "wolverine-trading",
    companyName: "Wolverine Trading",
    adapterKey: "pinpoint",
    sourceType: "pinpoint" as const,
    sourceUrl: "https://careers.wolve.com/en/postings.json",
    boardToken: null,
  });

  assert.equal(board.postingsUrl, "https://careers.wolve.com/en/postings.json");
  assert.equal(board.careersOrigin, "https://careers.wolve.com");
});

test("parsePinpointJobs keeps US engineering internships from JSON payload", () => {
  const source = {
    id: "src",
    companyId: "co",
    companySlug: "wolverine-trading",
    companyName: "Wolverine Trading",
    adapterKey: "pinpoint",
    sourceType: "pinpoint" as const,
    sourceUrl: "https://careers.wolve.com/en/postings.json",
    boardToken: null,
  };
  const result = parsePinpointJobs(
    [
      {
        id: "123",
        title: "Software Engineering Intern",
        url: "https://careers.wolve.com/en/postings/123",
        path: "/en/postings/123",
        description: "<p>Build trading systems during an internship program.</p>",
        employment_type_text: "Internship",
        job: {
          department: { name: "Technology" },
          division: { name: "Wolverine Trading" },
          structure_custom_group_one: { name: "Engineering" },
        },
        location: { city: "Chicago", name: "Chicago, IL", province: "Illinois" },
      },
      {
        id: "456",
        title: "Office Manager",
        url: "https://careers.wolve.com/en/postings/456",
        description: "<p>Operations role.</p>",
        employment_type_text: "Full Time",
        location: { name: "Chicago, IL" },
      },
    ],
    source,
    "https://careers.wolve.com",
    2,
  );

  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.roleName, "Software Engineering Intern");
  assert.equal(result.roles[0]?.location, "Chicago, IL");
  assert.equal(result.roles[0]?.dates?.source, "unknown");
});

test("formatOneXRecruiteeLocation joins location parts", () => {
  assert.equal(
    formatOneXRecruiteeLocation({
      locations: [{ city: "San Carlos", state: "California", country: "United States" }],
    }),
    "San Carlos, California, United States",
  );
});

test("parseOneXRecruiteeJobs keeps internship titles", () => {
  const source = {
    id: "src",
    companyId: "co",
    companySlug: "1x-technologies",
    companyName: "1X Technologies",
    adapterKey: "one_x_technologies",
    sourceType: "one_x_technologies" as const,
    sourceUrl: "https://1x.recruitee.com/api/offers/",
    boardToken: "1x",
  };
  const result = parseOneXRecruiteeJobs(
    [
      {
        status: "published",
        title: "AI Residency",
        careers_url: "https://1x.recruitee.com/o/ai-resident",
        description: "Internship program in San Carlos, CA.",
        locations: [{ city: "San Carlos", state: "California", country: "United States" }],
        published_at: "2026-05-01T00:00:00Z",
      },
      {
        status: "published",
        title: "Senior Counsel",
        careers_url: "https://1x.recruitee.com/o/senior-counsel",
        description: "Legal role.",
        locations: [{ city: "San Carlos", state: "California", country: "United States" }],
      },
    ],
    source,
    2,
  );
  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.roleName, "AI Residency");
  assert.equal(result.roles[0]?.dates?.source, "ats_publish");
});

test("parseOneXRecruiteeJobs treats updated-only dates as modified-only", () => {
  const source = {
    id: "src",
    companyId: "co",
    companySlug: "1x-technologies",
    companyName: "1X Technologies",
    adapterKey: "one_x_technologies",
    sourceType: "one_x_technologies" as const,
    sourceUrl: "https://1x.recruitee.com/api/offers/",
    boardToken: "1x",
  };
  const result = parseOneXRecruiteeJobs(
    [
      {
        status: "published",
        title: "Software Engineering Intern",
        careers_url: "https://1x.recruitee.com/o/software-engineering-intern",
        description: "Build robotics software as part of an internship program.",
        locations: [{ city: "San Carlos", state: "California", country: "United States" }],
        updated_at: "2026-05-02T00:00:00Z",
      },
    ],
    source,
    1,
  );

  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.dates?.source, "ats_modified");
  assert.equal(result.roles[0]?.dates?.published, null);
  assert.equal(result.roles[0]?.dates?.modified, "2026-05-02T00:00:00.000Z");
});

test("isWeightsBiasesGreenhouseJob matches Acquisition Company metadata", () => {
  assert.equal(
    isWeightsBiasesGreenhouseJob({
      metadata: [{ name: "Acquisition Company", value: "Weights & Biases" }],
    }),
    true,
  );
  assert.equal(
    isWeightsBiasesGreenhouseJob({
      metadata: [{ name: "Acquisition Company", value: "CoreWeave" }],
    }),
    false,
  );
});

test("parseModularJobs keeps US engineering roles from Gem API shape", () => {
  const jobs = [
    {
      absolute_url: "https://jobs.gem.com/modular/4606150005",
      title: "Software Engineer Intern, Compiler",
      content_plain: "Build Mojo libraries in Seattle. Summer internship.",
      employment_type: "full_time",
      first_published_at: "2026-01-01T00:00:00.000Z",
      location: { name: "Seattle, WA, United States" },
      departments: [{ name: "Engineering" }],
    },
    {
      absolute_url: "https://jobs.gem.com/modular/999",
      title: "VP Sales",
      content_plain: "Enterprise sales leadership.",
      employment_type: "full_time",
      location: { name: "New York, NY, United States" },
      departments: [{ name: "Sales" }],
    },
  ];
  const source = {
    id: "source-modular",
    companyId: "company-modular",
    companySlug: "modular",
    companyName: "Modular",
    adapterKey: "modular-gem",
    sourceType: "modular" as const,
    sourceUrl: "https://www.modular.com/company/careers",
    boardToken: "modular",
  };
  const result = parseModularJobs(jobs, source, jobs.length);
  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.roleName, "Software Engineer Intern, Compiler");
});

test("extractLumaGemJobsFromCareersHtml parses embedded jobsData", () => {
  const html = `"jobsData":[{"absolute_url":"https://jobs.gem.com/lumalabs-ai/job-1","title":"Software Engineer Intern","location":{"name":"Palo Alto, United States"},"employment_type":"intern","first_published_at":"2025-07-21T00:00:00.000Z","departments":[{"name":"Engineering"}]},{"absolute_url":"https://jobs.gem.com/lumalabs-ai/job-2","title":"VP Sales","location":{"name":"New York, United States"},"employment_type":"full_time"}]`;
  const jobs = extractLumaGemJobsFromCareersHtml(html);
  assert.equal(jobs.length, 2);
  const source = {
    id: "source-luma-ai",
    companyId: "company-luma-ai",
    companySlug: "luma-ai",
    companyName: "Luma AI",
    adapterKey: "luma-ai-gem",
    sourceType: "luma_ai" as const,
    sourceUrl: "https://lumalabs.ai/careers",
    boardToken: "lumalabs-ai",
  };
  const result = parseLumaAiJobs(jobs, source, jobs.length);
  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.roleName, "Software Engineer Intern");
});

test("isReplicateGreenhouseJob matches Replicate-tagged Cloudflare listings", () => {
  assert.equal(
    isReplicateGreenhouseJob({
      title: "Software Engineer, Replicate",
      content: "Build on the Replicate platform.",
      departments: [{ name: "Workers" }],
      metadata: [],
    }),
    true,
  );
  assert.equal(
    isReplicateGreenhouseJob({
      title: "Account Executive",
      content: "Cloudflare enterprise sales.",
      departments: [{ name: "Sales" }],
      metadata: [],
    }),
    false,
  );
});

test("isXCorpGreenhouseJob matches X platform roles on the shared xAI board", () => {
  assert.equal(
    isXCorpGreenhouseJob({
      title: "X Developer Platform – Forward Deployed Engineer, X API",
      content: "Build on the X API.",
      departments: [],
      metadata: [],
    }),
    true,
  );
  assert.equal(
    isXCorpGreenhouseJob({
      title: "Member of Technical Staff - Grok",
      content: "xAI model training.",
      departments: [{ name: "Grok" }],
      metadata: [],
    }),
    false,
  );
});

test("parseSakanaAiCareersHtml collects anchor job sections", () => {
  const board = { careersUrl: "https://sakana.ai/careers/" };
  const html = `
    <h2 id="open-positions">Open Positions</h2>
    <h2 id="software-engineer-product">Software Engineer (Product)</h2>
    <p>Based in Tokyo, Japan. Internships available.</p>
    <h2 id="member-of-technical-staff">Member of Technical Staff</h2>
    <p>Research internship in Tokyo.</p>
    <h2 id="ビジネス職プロダクトマネージャー">Duplicate JP</h2>
  `;
  const listings = parseSakanaAiCareersHtml(html, board);
  assert.equal(listings.length, 2);
  assert.equal(listings[0]?.postingUrl, "https://sakana.ai/careers/#software-engineer-product");
  assert.equal(shouldSkipSakanaHeadingId("ビジネス職"), true);
});

test("parseSurgeIndexHtml collects career detail paths", () => {
  const board = {
    careersOrigin: "https://www.surgehq.ai",
    indexUrl: "https://www.surgehq.ai/careers",
  };
  const html = `
    <a href="/careers">Index</a>
    <a href="/careers/backend-engineer">Backend Engineer</a>
    <a href="/careers/research-engineer-coding">Research Engineer</a>
  `;
  const listings = parseSurgeIndexHtml(html, board);
  assert.equal(listings.length, 2);
  assert.equal(
    listings.some((listing) => isSurgeListCandidate(listing)),
    false,
  );
});

test("parseSmartRecruitersJobs keeps US engineering interns", () => {
  const intern = {
    id: "744000111461585",
    name: "System Test Engineer  Intern",
    releasedDate: "2026-02-25T20:26:19.856Z",
    location: {
      city: "Santa Clara",
      region: "CA",
      country: "us",
      fullLocation: "Santa Clara, CA, United States",
    },
    department: { label: "Software Engineering" },
    typeOfEmployment: { id: "intern", label: "Intern" },
    experienceLevel: { id: "associate", label: "Associate" },
    postingUrl:
      "https://jobs.smartrecruiters.com/AristaNetworks/744000111461585-system-test-engineer-intern",
    jobAd: {
      sections: {
        jobDescription: {
          title: "Job Description",
          text: "<p>System test engineering internship for networking products.</p>",
        },
      },
    },
  };
  const auditIntern = {
    id: "744000129228200",
    name: "Economics Intern – Internal Audit",
    location: {
      country: "us",
      fullLocation: "Remote, OR, United States",
    },
    typeOfEmployment: { id: "intern", label: "Intern" },
    experienceLevel: { id: "internship", label: "Internship" },
    postingUrl: "https://jobs.smartrecruiters.com/AristaNetworks/744000129228200",
    jobAd: {
      sections: {
        jobDescription: {
          text: "<p>Support internal audit and finance teams.</p>",
        },
      },
    },
  };

  assert.equal(isSmartRecruitersListInternCandidate(intern), true);
  assert.equal(isSmartRecruitersListInternCandidate(auditIntern), true);

  const parsed = parseSmartRecruitersJobs([intern, auditIntern], {
    companyName: "Arista Networks",
    companySlug: "arista",
    sourceType: "smartrecruiters",
    adapterKey: "arista-smartrecruiters",
    sourceUrl: "https://careers.smartrecruiters.com/aristanetworks",
    boardToken: "AristaNetworks",
    id: "x",
    companyId: "y",
  });

  assert.equal(parsed.stats.fetched, 2);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /System Test Engineer/i);
  assert.equal(parsed.roles[0].location, "Santa Clara, CA, United States");
});

test("parseJobviteListHtml finds table listings with locations", () => {
  const board = resolveJobviteBoard({
    companyName: "Nutanix",
    companySlug: "nutanix",
    sourceType: "jobvite",
    adapterKey: "nutanix-jobvite",
    sourceUrl: "https://jobs.jobvite.com/nutanix",
    boardToken: "nutanix",
    id: "x",
    companyId: "y",
  });

  const fixturePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/scrape/nutanix-jobvite-list-snippet.html",
  );
  const html = readFileSync(fixturePath, "utf8");
  const jobs = parseJobviteListHtml(html, board);

  assert.ok(jobs.length >= 5);
  const manager = jobs.find((job) => job.title.includes("Global Accounts Payable Manager"));
  assert.ok(manager);
  assert.match(manager?.location ?? "", /San Jose/i);
  assert.equal(manager?.listUrl, "https://jobs.jobvite.com/nutanix/job/ob4Zzfwx");
});

test("isJobviteListCandidate matches internship titles", () => {
  assert.equal(
    isJobviteListCandidate({
      jobId: "abc",
      title: "Software Engineering Intern",
      listUrl: "https://jobs.jobvite.com/nutanix/job/abc",
      location: "San Jose, California",
    }),
    true,
  );
  assert.equal(
    isJobviteListCandidate({
      jobId: "def",
      title: "Senior Software Engineer",
      listUrl: "https://jobs.jobvite.com/nutanix/job/def",
      location: null,
    }),
    false,
  );
});

test("resolveSeagateBoard defaults search query to intern", () => {
  const board = resolveSeagateBoard({
    companyName: "Seagate",
    companySlug: "seagate",
    sourceType: "seagate",
    adapterKey: "seagate-careers-search",
    sourceUrl: "https://seagatecareers.com/search/",
    boardToken: "intern",
    id: "x",
    companyId: "y",
  });
  assert.equal(board.searchQuery, "intern");
  assert.match(buildSeagateSearchUrl(board, 10), /startrow=10/);
});

test("parseSeagateSearchHtml reads job tiles from fixture", () => {
  const board = resolveSeagateBoard({
    companyName: "Seagate",
    companySlug: "seagate",
    sourceType: "seagate",
    adapterKey: "seagate-careers-search",
    sourceUrl: "https://seagatecareers.com/search/",
    boardToken: "intern",
    id: "x",
    companyId: "y",
  });
  const html = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape/seagate-search-snippet.html"),
    "utf8",
  );
  const jobs = parseSeagateSearchHtml(html, board);
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].title, /Internal Communications/i);
  assert.equal(jobs[0].jobId, "1395009600");
  assert.match(jobs[0].listUrl, /1395009600/);
});

test("isSeagateListCandidate accepts internships and rejects internal-only roles", () => {
  assert.equal(
    isSeagateListCandidate({
      jobId: "1",
      title: "Machine Learning and Generative AI Intern",
      listUrl: "https://seagatecareers.com/job/x/1/",
      location: "Singapore",
    }),
    true,
  );
  assert.equal(
    isSeagateListCandidate({
      jobId: "2",
      title: "Internal Communications Executive (Junior)",
      listUrl: "https://seagatecareers.com/job/x/2/",
      location: null,
    }),
    false,
  );
});

test("parseSeagateJobDetailHtml extracts description from fixture", () => {
  const html = `<html><body><div class="jobdescription"><div><h2><b>About our group:</b></h2><p>Media development internship team.</p></div></div></div></body></html>`;
  const detail = parseSeagateJobDetailHtml(html);
  assert.match(detail.description, /About our group/i);
});

const wayfairSource: CompanySourceConfig = {
  id: "src-wayfair",
  companyId: "co-wayfair",
  companySlug: "wayfair",
  companyName: "Wayfair",
  sourceType: "wayfair",
  adapterKey: "wayfair-careers",
  sourceUrl: WAYFAIR_JOB_SEARCH_URL,
  boardToken: "wayfair",
};

test("resolveWayfairBoard uses job_search_data endpoint", () => {
  const board = resolveWayfairBoard(wayfairSource);
  assert.equal(board.jobSearchUrl, WAYFAIR_JOB_SEARCH_URL);
  assert.equal(board.careersOrigin, WAYFAIR_CAREERS_ORIGIN);
});

test("parseWayfairJobSearchResponse reads jobListData", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const job = JSON.parse(readFileSync(join(fixtureDir, "wayfair-intern-job.json"), "utf8"));
  const jobs = parseWayfairJobSearchResponse({ jobListData: [job] }, WAYFAIR_JOB_SEARCH_URL);
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].title ?? "", /Internship/i);
});

test("isWayfairListCandidate matches internship titles", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const job = JSON.parse(readFileSync(join(fixtureDir, "wayfair-intern-job.json"), "utf8"));
  assert.equal(isWayfairListCandidate(job), true);
  assert.equal(isWayfairListCandidate({ title: "Retail Sales Associate" }), false);
});

test("parseWayfairJobs keeps US engineering internships from fixture", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const job = {
    ...JSON.parse(readFileSync(join(fixtureDir, "wayfair-intern-job.json"), "utf8")),
    title: "Software Engineering Summer Intern",
    description:
      "<p>Software engineering internship building backend services in Python for fulfillment systems in Lathrop, CA.</p>",
    teamName: "Engineering",
    category: { name: "Engineering" },
  };
  const board = resolveWayfairBoard(wayfairSource);
  assert.equal(buildWayfairPostingUrl(board, job), `${WAYFAIR_CAREERS_ORIGIN}/jobs/62421`);
  assert.match(formatWayfairLocation(job) ?? "", /Lathrop/i);

  const parsed = parseWayfairJobs([job], wayfairSource, 1);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineering/i);
  assert.match(parsed.roles[0].location ?? "", /Lathrop/i);
});

const generalDynamicsSource: CompanySourceConfig = {
  id: "src-general-dynamics",
  companyId: "co-general-dynamics",
  companySlug: "general-dynamics",
  companyName: "General Dynamics",
  sourceType: "general_dynamics",
  adapterKey: "general-dynamics-sitecore",
  sourceUrl: GENERAL_DYNAMICS_JOB_SEARCH_URL,
  boardToken: "intern",
};

test("encodeGeneralDynamicsCareerSearchRequest gzip-encodes JSON payloads", () => {
  const encoded = encodeGeneralDynamicsCareerSearchRequest({ page: 0, what: "intern" });
  assert.ok(encoded.length > 0);
  assert.doesNotMatch(encoded, /^\{/);
});

test("parseGeneralDynamicsApiAuthFromHtml reads Sitecore auth attributes", () => {
  const html = `<div class="js-api-authentication" data-nonce="abc" data-signature="sig=" data-timestamp="2026-05-30T00:00:00Z"></div>`;
  const auth = parseGeneralDynamicsApiAuthFromHtml(html);
  assert.equal(auth?.nonce, "abc");
  assert.equal(auth?.signature, "sig=");
});

test("parseGeneralDynamicsSearchResponse maps CareerSearch rows", () => {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/scrape");
  const response = JSON.parse(
    readFileSync(join(fixtureDir, "general-dynamics-search-snippet.json"), "utf8"),
  );
  const listings = parseGeneralDynamicsSearchResponse(response, GENERAL_DYNAMICS_CAREERS_ORIGIN);
  assert.equal(listings.length, 2);
  assert.match(listings[0].postingUrl, /intern-technical-support/);
  assert.equal(isGeneralDynamicsListCandidate(listings[0]), true);
  assert.equal(isGeneralDynamicsListCandidate(listings[1]), false);
});

test("parseGeneralDynamicsJobDetailFields reads opportunity pages", () => {
  const html = `<h1 class="career-detail-title featured-title">Intern, Technical Support</h1>
    <dt>Location</dt><dd>Lincoln, NE, US</dd>
    <dt>Category</dt><dd>Project/Program Management</dd>
    <dt>Business Unit</dt><dd>GD Ordnance and Tactical Systems</dd>
    <div class="career-detail-description"><p>Year-round internship in Lincoln, NE.</p></div>`;
  const fields = parseGeneralDynamicsJobDetailFields(html);
  assert.equal(fields.title, "Intern, Technical Support");
  assert.match(fields.description, /Year-round internship/i);
  assert.equal(fields.unavailable, false);
});

test("parseGeneralDynamicsJobs keeps US intern listings from search snippet", () => {
  const listings = [
    {
      title: "Software Engineering Intern",
      postingUrl: `${GENERAL_DYNAMICS_CAREERS_ORIGIN}/careers/software-engineering-intern-lincoln-ne-us`,
      location: "Lincoln, NE, US",
      category: "Engineering",
      companyUnit: "GD Mission Systems",
      description:
        "<p>Software engineering internship program for students building embedded systems.</p>",
      datePosted: "2026-05-26T15:25:24Z",
    },
  ];
  const parsed = parseGeneralDynamicsJobs(listings, generalDynamicsSource, 1);
  assert.equal(parsed.roles.length, 1);
  assert.match(parsed.roles[0].roleName, /Software Engineering Intern/i);
  assert.match(buildGeneralDynamicsPostingUrl(GENERAL_DYNAMICS_CAREERS_ORIGIN, "/careers/x-opportunity") ?? "", /gd\.com/);
});

test("resolveGeneralDynamicsBoard normalizes search keywords", () => {
  const board = resolveGeneralDynamicsBoard({
    ...generalDynamicsSource,
    boardToken: "internship",
  });
  assert.equal(board.searchKeywords[0], "internship");
  assert.ok(board.searchKeywords.includes("intern"));
});
