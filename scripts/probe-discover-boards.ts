/**
 * Probe Greenhouse / Ashby / Lever / Workday / Microsoft public job boards.
 * Usage: node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-specifier-resolution=node scripts/probe-discover-boards.ts
 */
export {};

const WORKDAY_BOARDS: Array<{ slug: string; cxsJobsUrl: string }> = [
  {
    slug: "nvidia",
    cxsJobsUrl:
      "https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs",
  },
];

const EXISTING = new Set([
  "anthropic","openai","scale-ai","cohere","perplexity","harvey","langchain","character-ai",
  "elevenlabs","decagon","deepgram","cursor","sierra","anyscale","modal","xai","fal","runpod",
  "benchling","stripe","ramp","robinhood","brex","plaid","coinbase","affirm","chime","block",
  "mercury","column","marqeta","gemini","binance","sofi","phantom","carta","monzo","n26",
  "vercel","supabase","datadog","cloudflare","mongodb","databricks","snowflake","gitlab",
  "elastic","cockroachlabs","planetscale","render","tailscale","posthog","replit","neon",
  "resend","merge","fastly","okta","zscaler","twilio","pagerduty","new-relic","box",
  "pure-storage","launchdarkly","amplitude","mixpanel","1password","deel","watershed",
  "jetbrains","clickhouse","fivetran","confluent","sentry","hex-technologies","airbnb",
  "doordash","instacart","spotify","reddit","discord","roblox","riot-games","pinterest",
  "netflix","duolingo","nextdoor","tripadvisor","coursera","carvana","squarespace","toast",
  "lyft","dropbox","epic-games","unity","notion","figma","linear","asana","airtable",
  "hubspot","gusto","ironclad","zip","clay","rippling","loom","calendly","bill-com","yext",
  "flexport","shopify","oscar","intercom","waymo","nuro","aurora","lucid-motors",
  "applied-intuition","uber-freight","samsara","spacex","anduril","palantir","hackerone",
  "optiver","aquatic-capital","jump-trading","drw","imc","akuna-capital","aqr","worldquant",
  "point72","virtu","flow-traders","schonfeld",
]);

const CANDIDATES: Array<{ token: string; slug?: string; type: "gh" | "ashby" | "lever" }> = [
  // GH tokens (slug defaults to token unless slug set)
  { token: "gusto", type: "gh" },
  { token: "hashicorp", type: "gh" },
  { token: "crowdstrike", type: "gh" },
  { token: "rivian", type: "gh" },
  { token: "etsy", type: "gh" },
  { token: "snapchat", type: "gh" },
  { token: "zendesk", type: "gh" },
  { token: "klarna", type: "gh" },
  { token: "wise", type: "gh" },
  { token: "checkout", type: "gh" },
  { token: "gopuff", type: "gh" },
  { token: "warbyparker", type: "gh" },
  { token: "zillow", type: "gh" },
  { token: "redfin", type: "gh" },
  { token: "opendoor", type: "gh" },
  { token: "compass", type: "gh" },
  { token: "databricks", type: "gh" },
  { token: "hashicorp", type: "gh" },
  { token: "gitlab", type: "gh" },
  { token: "sourcegraph", type: "gh" },
  { token: "snyk", type: "gh" },
  { token: "circleci", type: "gh" },
  { token: "grubhub", type: "gh" },
  { token: "chewy", type: "gh" },
  { token: "wayfair", type: "gh" },
  { token: "fanatics", type: "gh" },
  { token: "dickssportinggoods", type: "gh" },
  { token: "bestbuy", type: "gh" },
  { token: "target", type: "gh" },
  { token: "walmart", type: "gh" },
  { token: "doordashusa", type: "gh", slug: "doordash" },
  { token: "andurilindustries", type: "gh", slug: "anduril" },
  { token: "scaleai", type: "gh", slug: "scale-ai" },
  { token: "riotgames", type: "gh", slug: "riot-games" },
  { token: "redditinc", type: "gh", slug: "reddit" },
  { token: "uberfreight", type: "gh", slug: "uber-freight" },
  { token: "lucidmotors", type: "gh", slug: "lucid-motors" },
  { token: "appliedintuition", type: "gh", slug: "applied-intuition" },
  { token: "purestorage", type: "gh", slug: "pure-storage" },
  { token: "billcom", type: "gh", slug: "bill-com" },
  { token: "newrelic", type: "gh", slug: "new-relic" },
  { token: "cockroachlabs", type: "gh" },
  { token: "okta", type: "gh" },
  { token: "grammarly", type: "gh" },
  { token: "duolingo", type: "gh" },
  { token: "hubspot", type: "gh" },
  { token: "asana", type: "gh" },
  { token: "dropbox", type: "gh" },
  { token: "figma", type: "gh" },
  { token: "airbnb", type: "gh" },
  { token: "stripe", type: "gh" },
  { token: "robinhood", type: "gh" },
  { token: "affirm", type: "gh" },
  { token: "chime", type: "gh" },
  { token: "mercury", type: "gh" },
  { token: "brex", type: "gh" },
  { token: "block", type: "gh" },
  { token: "flexport", type: "gh" },
  { token: "carta", type: "gh" },
  { token: "lyft", type: "gh" },
  { token: "pinterest", type: "gh" },
  { token: "toast", type: "gh" },
  { token: "oscar", type: "gh" },
  { token: "fastly", type: "gh" },
  { token: "nuro", type: "gh" },
  { token: "waymo", type: "gh" },
  { token: "gitlab", type: "gh" },
  { token: "mixpanel", type: "gh" },
  { token: "amplitude", type: "gh" },
  { token: "launchdarkly", type: "gh" },
  { token: "planetscale", type: "gh" },
  { token: "elastic", type: "gh" },
  { token: "twilio", type: "gh" },
  { token: "zscaler", type: "gh" },
  { token: "okta", type: "gh" },
  { token: "boxinc", type: "gh", slug: "box" },
  { token: "yext", type: "gh" },
  { token: "tripadvisor", type: "gh" },
  { token: "nextdoor", type: "gh" },
  { token: "coursera", type: "gh" },
  { token: "carvana", type: "gh" },
  { token: "squarespace", type: "gh" },
  { token: "samsara", type: "gh" },
  { token: "aurorainnovation", type: "gh", slug: "aurora" },
  { token: "marqeta", type: "gh" },
  { token: "sofi", type: "gh" },
  { token: "gemini", type: "gh" },
  { token: "tailscale", type: "gh" },
  { token: "pagerduty", type: "gh" },
  { token: "calendly", type: "gh" },
  { token: "ginkgo", type: "gh" },
  { token: "tempus", type: "gh" },
  { token: "10xgenomics", type: "gh", slug: "10x-genomics" },
  { token: "illumina", type: "gh" },
  { token: "guardanthealth", type: "gh", slug: "guardant-health" },
  { token: "niantic", type: "gh" },
  { token: "scopely", type: "gh" },
  { token: "twitch", type: "gh" },
  { token: "sony", type: "gh" },
  { token: "disney", type: "gh" },
  { token: "warnermedia", type: "gh" },
  { token: "spotify", type: "gh" },
  { token: "soundcloud", type: "gh" },
  { token: "pandora", type: "gh" },
  { token: "okta", type: "gh" },
  { token: "servicetitan", type: "gh", slug: "servicetitan" },
  { token: "procore", type: "gh" },
  { token: "autodesk", type: "gh" },
  { token: "ansys", type: "gh" },
  { token: "cadence", type: "gh" },
  { token: "synopsys", type: "gh" },
  { token: "nvidia", type: "gh" },
  { token: "amd", type: "gh" },
  { token: "intel", type: "gh" },
  { token: "qualcomm", type: "gh" },
  { token: "tesla", type: "gh" },
  { token: "ford", type: "gh" },
  { token: "gm", type: "gh" },
  { token: "toyota", type: "gh" },
  { token: "honda", type: "gh" },
  { token: "bmw", type: "gh" },
  { token: "volkswagen", type: "gh" },
  { token: "mercedesbenz", type: "gh", slug: "mercedes-benz" },
  { token: "volvo", type: "gh" },
  { token: "polestar", type: "gh" },
  { token: "rivian", type: "gh" },
  { token: "chargepoint", type: "gh" },
  { token: "bird", type: "gh" },
  { token: "lime", type: "gh" },
  { token: "bird", type: "gh" },
  { token: "instacart", type: "gh" },
  { token: "gopuff", type: "gh" },
  { token: "faire", type: "gh" },
  { token: "wish", type: "gh" },
  { token: "poshmark", type: "gh" },
  { token: "depop", type: "gh" },
  { token: "thredup", type: "gh" },
  { token: "renttherunway", type: "gh", slug: "rent-the-runway" },
  { token: "stitchfix", type: "gh", slug: "stitch-fix" },
  { token: "warbyparker", type: "gh", slug: "warby-parker" },
  { token: "allbirds", type: "gh" },
  { token: "glossier", type: "gh" },
  { token: "away", type: "gh" },
  { token: "casper", type: "gh" },
  { token: "peloton", type: "gh" },
  { token: "whoop", type: "gh" },
  { token: "oura", type: "gh" },
  { token: "headspace", type: "gh" },
  { token: "calm", type: "gh" },
  { token: "noom", type: "gh" },
  { token: "hims", type: "gh" },
  { token: "ro", type: "gh" },
  { token: "nurx", type: "gh" },
  { token: "teladoc", type: "gh" },
  { token: "devoted", type: "gh", slug: "devoted-health" },
  { token: "cloverhealth", type: "gh", slug: "clover-health" },
  { token: "cityblock", type: "gh", slug: "cityblock-health" },
  { token: "color", type: "gh" },
  { token: "flatiron", type: "gh", slug: "flatiron-health" },
  { token: "verily", type: "gh" },
  { token: "tempus", type: "gh" },
  { token: "recursion", type: "gh" },
  { token: "modernatx", type: "gh", slug: "moderna" },
  { token: "bioNTech", type: "gh" },
  { token: "stripe", type: "gh" },
  { token: "adyen", type: "gh" },
  { token: "checkout", type: "gh" },
  { token: "revolut", type: "gh" },
  { token: "n26", type: "gh" },
  { token: "monzo", type: "gh" },
  { token: "starlingbank", type: "gh", slug: "starling-bank" },
  { token: "plaid", type: "gh" },
  { token: "affirm", type: "gh" },
  { token: "klarna", type: "gh" },
  { token: "afterpay", type: "gh" },
  { token: "sezzle", type: "gh" },
  { token: "marqeta", type: "gh" },
  { token: "galileo", type: "gh" },
  { token: "unit", type: "gh" },
  { token: "treasuryprime", type: "gh", slug: "treasury-prime" },
  { token: "synapse", type: "gh" },
  { token: "lithic", type: "gh" },
  { token: "highnote", type: "gh" },
  { token: "increase", type: "gh" },
  { token: "modern treasury", type: "gh" },
  { token: "moderntreasury", type: "gh", slug: "modern-treasury" },
  { token: "ramp", type: "gh" },
  { token: "brex", type: "gh" },
  { token: "airwallex", type: "gh" },
  { token: "wise", type: "gh" },
  { token: "remitly", type: "gh" },
  { token: "wise", type: "gh" },
  { token: "dlocal", type: "gh" },
  { token: "rapyd", type: "gh" },
  { token: "payoneer", type: "gh" },
  // Ashby
  { token: "retool", type: "ashby" },
  { token: "hex", type: "ashby" },
  { token: "dbt", type: "ashby" },
  { token: "dbtlabs", type: "ashby", slug: "dbt-labs" },
  { token: "hightouch", type: "ashby" },
  { token: "census", type: "ashby" },
  { token: "fivetran", type: "ashby" },
  { token: "airbyte", type: "ashby" },
  { token: "prefect", type: "ashby" },
  { token: "dagster", type: "ashby" },
  { token: "materialize", type: "ashby" },
  { token: "starburst", type: "ashby" },
  { token: "databricks", type: "ashby" },
  { token: "weights", type: "ashby" },
  { token: "wandb", type: "ashby" },
  { token: "together", type: "ashby" },
  { token: "togetherai", type: "ashby", slug: "together-ai" },
  { token: "mistral", type: "ashby" },
  { token: "groq", type: "ashby" },
  { token: "cerebras", type: "ashby" },
  { token: "fireworks", type: "ashby" },
  { token: "replicate", type: "ashby" },
  { token: "huggingface", type: "ashby" },
  { token: "stability", type: "ashby" },
  { token: "midjourney", type: "ashby" },
  { token: "adept", type: "ashby" },
  { token: "inflection", type: "ashby" },
  { token: "copy", type: "ashby" },
  { token: "jasper", type: "ashby" },
  { token: "writer", type: "ashby" },
  { token: "glean", type: "ashby" },
  { token: "dust", type: "ashby" },
  { token: "hebbia", type: "ashby" },
  { token: "ramp", type: "ashby" },
  { token: "vanta", type: "ashby" },
  { token: "drata", type: "ashby" },
  { token: "secureframe", type: "ashby" },
  { token: "thoropass", type: "ashby" },
  { token: "anomalo", type: "ashby" },
  { token: "montecarlo", type: "ashby", slug: "monte-carlo" },
  { token: "bigeye", type: "ashby" },
  { token: "transform", type: "ashby" },
  { token: "omni", type: "ashby" },
  { token: "mode", type: "ashby" },
  { token: "sigma", type: "ashby" },
  { token: "preset", type: "ashby" },
  { token: "lightdash", type: "ashby" },
  { token: "metabase", type: "ashby" },
  { token: "duckdb", type: "ashby" },
  { token: "motherduck", type: "ashby" },
  { token: "timescale", type: "ashby" },
  { token: "cockroach", type: "ashby" },
  { token: "singlestore", type: "ashby" },
  { token: "redis", type: "ashby" },
  { token: "upstash", type: "ashby" },
  { token: "turso", type: "ashby" },
  { token: "prisma", type: "ashby" },
  { token: "hasura", type: "ashby" },
  { token: "fauna", type: "ashby" },
  { token: "vercel", type: "ashby" },
  { token: "railway", type: "ashby" },
  { token: "fly", type: "ashby" },
  { token: "netlify", type: "ashby" },
  { token: "deno", type: "ashby" },
  { token: "bun", type: "ashby" },
  { token: "vercel", type: "ashby" },
  { token: "sanity", type: "ashby" },
  { token: "contentful", type: "ashby" },
  { token: "webflow", type: "ashby" },
  { token: "framer", type: "ashby" },
  { token: "lovable", type: "ashby" },
  { token: "bolt", type: "ashby" },
  { token: "replit", type: "ashby" },
  { token: "sourcegraph", type: "ashby" },
  { token: "gitpod", type: "ashby" },
  { token: "coder", type: "ashby" },
  { token: "buildkite", type: "ashby" },
  { token: "launchdarkly", type: "ashby" },
  { token: "statsig", type: "ashby" },
  { token: "eppo", type: "ashby" },
  { token: "optimizely", type: "ashby" },
  { token: "pendo", type: "ashby" },
  { token: "fullstory", type: "ashby" },
  { token: "heap", type: "ashby" },
  { token: "logrocket", type: "ashby" },
  { token: "highlight", type: "ashby" },
  { token: "baseten", type: "ashby" },
  { token: "coreweave", type: "ashby" },
  { token: "lambda", type: "ashby" },
  { token: "anyscale", type: "ashby" },
  { token: "labelbox", type: "ashby" },
  { token: "scale", type: "ashby" },
  { token: "snorkel", type: "ashby" },
  { token: "surge", type: "ashby" },
  { token: "turing", type: "ashby" },
  { token: "anduril", type: "ashby" },
  { token: "shield", type: "ashby", slug: "shield-ai" },
  { token: "skydio", type: "ashby" },
  { token: "relativity", type: "ashby" },
  { token: "figure", type: "ashby", slug: "figure-ai" },
  { token: "1x", type: "ashby" },
  { token: "covariant", type: "ashby" },
  { token: "nimble", type: "ashby" },
  { token: "flexport", type: "ashby" },
  { token: "project44", type: "ashby", slug: "project-44" },
  { token: "fourkites", type: "ashby" },
  { token: "sift", type: "ashby" },
  { token: "persona", type: "ashby" },
  { token: "alloy", type: "ashby" },
  { token: "unit21", type: "ashby", slug: "unit21" },
  { token: "middesk", type: "ashby" },
  { token: "oscilar", type: "ashby" },
  { token: "socure", type: "ashby" },
  { token: "sentilink", type: "ashby" },
  { token: "persona", type: "ashby" },
  // Lever
  { token: "palantir", type: "lever" },
  { token: "netflix", type: "lever" },
  { token: "binance", type: "lever" },
  { token: "spotify", type: "lever" },
  { token: "lyft", type: "lever" },
  { token: "dropbox", type: "lever" },
  { token: "box", type: "lever" },
  { token: "github", type: "lever" },
  { token: "atlassian", type: "lever" },
  { token: "twilio", type: "lever" },
  { token: "zendesk", type: "lever" },
  { token: "shopify", type: "lever" },
  { token: "square", type: "lever" },
  { token: "block", type: "lever" },
  { token: "affirm", type: "lever" },
  { token: "chime", type: "lever" },
  { token: "robinhood", type: "lever" },
  { token: "coinbase", type: "lever" },
  { token: "plaid", type: "lever" },
  { token: "ramp", type: "lever" },
  { token: "brex", type: "lever" },
  { token: "mercury", type: "lever" },
  { token: "gusto", type: "lever" },
  { token: "rippling", type: "lever" },
  { token: "deel", type: "lever" },
  { token: "remote", type: "lever" },
  { token: "gitlab", type: "lever" },
  { token: "docker", type: "lever" },
  { token: "hashicorp", type: "lever" },
  { token: "databricks", type: "lever" },
  { token: "snowflake", type: "lever" },
  { token: "mongodb", type: "lever" },
  { token: "elastic", type: "lever" },
  { token: "confluent", type: "lever" },
  { token: "cockroachlabs", type: "lever" },
  { token: "planetscale", type: "lever" },
  { token: "vercel", type: "lever" },
  { token: "netlify", type: "lever" },
  { token: "heroku", type: "lever" },
  { token: "digitalocean", type: "lever", slug: "digitalocean" },
  { token: "cloudflare", type: "lever" },
  { token: "fastly", type: "lever" },
  { token: "akamai", type: "lever" },
  { token: "okta", type: "lever" },
  { token: "auth0", type: "lever" },
  { token: "1password", type: "lever" },
  { token: "lastpass", type: "lever" },
  { token: "bitwarden", type: "lever" },
  { token: "snyk", type: "lever" },
  { token: "lacework", type: "lever" },
  { token: "wiz", type: "lever" },
  { token: "orca", type: "lever" },
  { token: "crowdstrike", type: "lever" },
  { token: "sentinelone", type: "lever", slug: "sentinelone" },
  { token: "tenable", type: "lever" },
  { token: "qualys", type: "lever" },
  { token: "zscaler", type: "lever" },
  { token: "paloaltonetworks", type: "lever", slug: "palo-alto-networks" },
  { token: "fortinet", type: "lever" },
  { token: "rubrik", type: "lever" },
  { token: "cohesity", type: "lever" },
  { token: "veeam", type: "lever" },
  { token: "nutanix", type: "lever" },
  { token: "vmware", type: "lever" },
  { token: "redhat", type: "lever", slug: "red-hat" },
  { token: "canonical", type: "lever" },
  { token: "ubuntu", type: "lever" },
  { token: "stripe", type: "lever" },
  { token: "adyen", type: "lever" },
  { token: "checkout", type: "lever" },
  { token: "klarna", type: "lever" },
  { token: "revolut", type: "lever" },
  { token: "n26", type: "lever" },
  { token: "monzo", type: "lever" },
  { token: "transferwise", type: "lever", slug: "wise" },
  { token: "wise", type: "lever" },
  { token: "rippling", type: "lever" },
  { token: "figma", type: "lever" },
  { token: "notion", type: "lever" },
  { token: "airtable", type: "lever" },
  { token: "coda", type: "lever" },
  { token: "miro", type: "lever" },
  { token: "canva", type: "lever" },
  { token: "asana", type: "lever" },
  { token: "monday", type: "lever", slug: "monday-com" },
  { token: "clickup", type: "lever" },
  { token: "airbnb", type: "lever" },
  { token: "booking", type: "lever" },
  { token: "expedia", type: "lever" },
  { token: "tripadvisor", type: "lever" },
  { token: "doordash", type: "lever" },
  { token: "instacart", type: "lever" },
  { token: "grubhub", type: "lever" },
  { token: "uber", type: "lever" },
  { token: "lyft", type: "lever" },
  { token: "waymo", type: "lever" },
  { token: "zoox", type: "lever" },
  { token: "aurora", type: "lever" },
  { token: "rivian", type: "lever" },
  { token: "lucid", type: "lever", slug: "lucid-motors" },
  { token: "tesla", type: "lever" },
  { token: "spacex", type: "lever" },
  { token: "anduril", type: "lever" },
  { token: "relativity", type: "lever" },
  { token: "rocketlab", type: "lever", slug: "rocket-lab" },
  { token: "planet", type: "lever" },
  { token: "spacex", type: "lever" },
];

async function probeGh(token: string): Promise<number | null> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { jobs?: unknown[] };
  const n = data.jobs?.length ?? 0;
  return n > 0 ? n : null;
}

async function probeAshby(token: string): Promise<number | null> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${token}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { jobs?: unknown[] };
  const n = data.jobs?.length ?? 0;
  return n > 0 ? n : null;
}

async function probeWorkday(cxsJobsUrl: string): Promise<number | null> {
  const res = await fetch(cxsJobsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "intern" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { total?: number };
  const n = typeof data.total === "number" ? data.total : 0;
  return n > 0 ? n : null;
}

async function probeLever(token: string): Promise<number | null> {
  const res = await fetch(`https://api.lever.co/v0/postings/${token}?mode=json`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  const n = Array.isArray(data) ? data.length : 0;
  return n > 0 ? n : null;
}

async function probeApple(
  sourceUrl = "https://jobs.apple.com/en-us/search?location=united-states-USA&search=intern",
): Promise<number | null> {
  const res = await fetch(sourceUrl, {
    headers: { accept: "text/html", "user-agent": "Pathway probe" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const html = await res.text();
  const marker = "__staticRouterHydrationData = JSON.parse(";
  const start = html.indexOf(marker);
  if (start < 0) return null;

  let index = start + marker.length;
  if (html[index] !== '"') return null;
  index += 1;

  let escaped = "";
  let escapedChar = false;
  for (; index < html.length; index += 1) {
    const char = html[index];
    if (escapedChar) {
      escaped += char;
      escapedChar = false;
      continue;
    }
    if (char === "\\") {
      escapedChar = true;
      continue;
    }
    if (char === '"') break;
    escaped += char;
  }

  try {
    const payload = JSON.parse(escaped) as { loaderData?: { search?: { totalRecords?: number } } };
    const n = payload.loaderData?.search?.totalRecords ?? 0;
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function probeMicrosoft(domain = "microsoft.com"): Promise<number | null> {
  const url = new URL("https://apply.careers.microsoft.com/api/pcsx/search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("query", "intern");
  url.searchParams.set("location", "");
  url.searchParams.set("start", "0");
  url.searchParams.set("sort_by", "timestamp");

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { positions?: unknown[] } };
  const n = data.data?.positions?.length ?? 0;
  return n > 0 ? n : null;
}

function slugify(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const seen = new Set<string>();
const hits: Array<{ slug: string; token: string; type: string; jobs: number }> = [];

for (const board of WORKDAY_BOARDS) {
  if (EXISTING.has(board.slug)) continue;
  const jobs = await probeWorkday(board.cxsJobsUrl);
  if (jobs !== null) {
    hits.push({ slug: board.slug, token: board.slug, type: "workday", jobs });
    process.stderr.write(`+ workday ${board.slug} ${jobs}\n`);
  }
}

if (!EXISTING.has("microsoft")) {
  const jobs = await probeMicrosoft();
  if (jobs !== null) {
    hits.push({ slug: "microsoft", token: "microsoft.com", type: "microsoft", jobs });
    process.stderr.write(`+ microsoft microsoft.com ${jobs}\n`);
  }
}

if (!EXISTING.has("apple")) {
  const jobs = await probeApple();
  if (jobs !== null) {
    hits.push({ slug: "apple", token: "en-us", type: "apple", jobs });
    process.stderr.write(`+ apple en-us ${jobs}\n`);
  }
}

for (const c of CANDIDATES) {
  const slug = c.slug ?? slugify(c.token);
  if (EXISTING.has(slug) || seen.has(`${c.type}:${c.token}`)) continue;
  seen.add(`${c.type}:${c.token}`);

  let jobs: number | null = null;
  if (c.type === "gh") jobs = await probeGh(c.token);
  else if (c.type === "ashby") jobs = await probeAshby(c.token);
  else jobs = await probeLever(c.token);

  if (jobs !== null && !EXISTING.has(slug)) {
    hits.push({ slug, token: c.token, type: c.type, jobs });
    process.stderr.write(`+ ${c.type} ${c.token} (${slug}) ${jobs}\n`);
  }
}

hits.sort((a, b) => a.slug.localeCompare(b.slug));
console.log(JSON.stringify(hits, null, 2));
console.error(`\n${hits.length} new boards (${EXISTING.size} existing)`);
