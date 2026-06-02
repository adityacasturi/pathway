/**
 * Generates bulk SQL for company → industry backfills.
 * Run: node scripts/generate-discover-industry-migration.mjs
 *
 * Canonical taxonomy and workflow: docs/discover-industries.md
 * Edit COMPANY_INDUSTRY below, review output, then apply_migration on Supabase.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CATALOG = [
  ["platform", "Big tech", "Hyperscale platforms with flagship intern programs.", 10],
  ["semiconductor", "Semiconductors", "Chip designers, fabs, and semiconductor IP.", 20],
  ["networking", "Networking", "Network hardware, routing, and edge delivery.", 25],
  ["ai-research", "AI research", "Foundation-model and AGI research labs.", 30],
  ["ai-products", "AI products", "AI-native apps, agents, and creative tools.", 40],
  ["ai-infrastructure", "AI infrastructure", "Training, inference, MLOps, and AI compute.", 50],
  ["life-sciences", "Life sciences", "Biotech, genomics, and lab software.", 60],
  ["payments", "Payments", "Payment processors, rails, and card networks.", 70],
  ["fintech", "Fintech", "Neobanks, lending, and financial APIs.", 80],
  ["banking", "Banking & markets", "Banks, brokerages, and markets infrastructure.", 90],
  ["crypto", "Crypto", "Digital assets, exchanges, and on-chain infra.", 100],
  ["cloud", "Cloud & hosting", "CDN, cloud platforms, and core IT infrastructure.", 110],
  ["data", "Data platforms", "Warehouses, databases, pipelines, and analytics.", 120],
  ["devtools", "Developer tools", "SDLC, CI/CD, and developer platforms.", 130],
  ["cybersecurity", "Cybersecurity", "Security software, identity, and compliance.", 140],
  ["defense", "Defense", "Defense primes and military technology.", 150],
  ["space", "Space", "Launch vehicles, satellites, and space systems.", 160],
  ["aviation", "Aviation", "Aircraft OEMs and advanced air mobility.", 170],
  ["automotive", "Automotive", "Vehicle OEMs, EVs, and charging networks.", 180],
  [
    "autonomous-vehicles",
    "Autonomous vehicles",
    "Self-driving software, simulation, and robotaxi stacks.",
    190,
  ],
  ["robotics", "Robotics", "Humanoids and general-purpose robots.", 200],
  ["drones", "Drones", "Commercial and industrial unmanned aircraft.", 210],
  ["quant", "Quant trading", "HFT, market making, and systematic trading.", 220],
  ["gaming", "Gaming", "Studios, engines, and gaming platforms.", 230],
  ["streaming", "Streaming", "Video and audio streaming platforms.", 240],
  ["social", "Social", "Social networks and online communities.", 250],
  ["marketplaces", "Marketplaces", "Two-sided consumer and prosumer marketplaces.", 260],
  ["on-demand", "On-demand", "Rideshare, delivery, and last-mile logistics.", 270],
  ["ecommerce", "E-commerce", "Online retail, proptech, and commerce SaaS.", 280],
  [
    "enterprise-software",
    "Enterprise software",
    "CRM, ERP, vertical SaaS, and business systems.",
    290,
  ],
  ["productivity", "Productivity", "Design, docs, and team collaboration software.", 300],
  ["hr-tech", "HR & payroll", "HRIS, payroll, and global employment platforms.", 310],
  ["healthtech", "Healthtech", "Digital health plans and care delivery.", 320],
  [
    "consumer-tech",
    "Consumer tech",
    "Consumer apps outside social, commerce, and on-demand.",
    330,
  ],
];

/** slug → new industry (complete map for all active Discover companies). */
const COMPANY_INDUSTRY = {
  // platform
  amazon: "platform",
  apple: "platform",
  google: "platform",
  meta: "platform",
  microsoft: "platform",
  nvidia: "platform",
  zoom: "platform",

  // semiconductor
  amd: "semiconductor",
  "analog-devices": "semiconductor",
  broadcom: "semiconductor",
  intel: "semiconductor",
  marvell: "semiconductor",
  micron: "semiconductor",
  qualcomm: "semiconductor",
  seagate: "semiconductor",
  "texas-instruments": "semiconductor",
  "western-digital": "semiconductor",

  // networking
  akamai: "networking",
  arista: "networking",
  cisco: "networking",
  f5: "networking",
  "juniper-networks": "networking",

  // ai-research
  "adept-ai": "ai-research",
  anthropic: "ai-research",
  cohere: "ai-research",
  cognition: "ai-research",
  imbue: "ai-research",
  mistral: "ai-research",
  openai: "ai-research",
  poolside: "ai-research",
  xai: "ai-research",

  // ai-products
  "character-ai": "ai-products",
  cursor: "ai-products",
  decagon: "ai-products",
  deepgram: "ai-products",
  dust: "ai-products",
  elevenlabs: "ai-products",
  glean: "ai-products",
  grammarly: "ai-products",
  harvey: "ai-products",
  langchain: "ai-products",
  lovable: "ai-products",
  perplexity: "ai-products",
  pika: "ai-products",
  runway: "ai-products",
  sierra: "ai-products",
  "stability-ai": "ai-products",
  suno: "ai-products",
  writer: "ai-products",

  // ai-infrastructure
  anyscale: "ai-infrastructure",
  baseten: "ai-infrastructure",
  cerebras: "ai-infrastructure",
  fal: "ai-infrastructure",
  groq: "ai-infrastructure",
  "hugging-face": "ai-infrastructure",
  labelbox: "ai-infrastructure",
  modal: "ai-infrastructure",
  runpod: "ai-infrastructure",
  "scale-ai": "ai-infrastructure",
  "snorkel-ai": "ai-infrastructure",
  "surge-ai": "ai-infrastructure",
  "together-ai": "ai-infrastructure",

  // life-sciences
  "10x-genomics": "life-sciences",
  benchling: "life-sciences",

  // payments
  adyen: "payments",
  column: "payments",
  lithic: "payments",
  marqeta: "payments",
  paypal: "payments",
  stripe: "payments",
  visa: "payments",

  // fintech
  affirm: "fintech",
  block: "fintech",
  brex: "fintech",
  carta: "fintech",
  chime: "fintech",
  figure: "fintech",
  highnote: "fintech",
  mercury: "fintech",
  middesk: "fintech",
  monzo: "fintech",
  n26: "fintech",
  oscilar: "fintech",
  payoneer: "fintech",
  persona: "fintech",
  plaid: "fintech",
  ramp: "fintech",
  robinhood: "fintech",
  sentilink: "fintech",
  sezzle: "fintech",
  sift: "fintech",
  socure: "fintech",
  sofi: "fintech",

  // banking
  bloomberg: "banking",
  "capital-one": "banking",
  citigroup: "banking",
  "goldman-sachs": "banking",
  "jpmorgan-chase": "banking",
  "morgan-stanley": "banking",

  // crypto
  anchorage: "crypto",
  binance: "crypto",
  blockchain: "crypto",
  coinbase: "crypto",
  fireblocks: "crypto",
  gemini: "crypto",
  phantom: "crypto",
  ripple: "crypto",

  // cloud
  box: "cloud",
  cloudflare: "cloud",
  cohesity: "cloud",
  coreweave: "cloud",
  digitalocean: "cloud",
  fastly: "cloud",
  lambda: "cloud",
  nebius: "cloud",
  nutanix: "cloud",
  pagerduty: "cloud",
  "pure-storage": "cloud",
  railway: "cloud",
  render: "cloud",
  tailscale: "cloud",
  twilio: "cloud",
  vmware: "cloud",

  // data
  airbyte: "data",
  amplitude: "data",
  braze: "data",
  clickhouse: "data",
  cockroachlabs: "data",
  confluent: "data",
  databricks: "data",
  datadog: "data",
  "dbt-labs": "data",
  elastic: "data",
  fivetran: "data",
  fullstory: "data",
  "hex-technologies": "data",
  lightdash: "data",
  materialize: "data",
  mixpanel: "data",
  mongodb: "data",
  motherduck: "data",
  "new-relic": "data",
  omni: "data",
  planetscale: "data",
  snowflake: "data",
  statsig: "data",
  teradata: "data",

  // devtools
  buildkite: "devtools",
  canonical: "devtools",
  circleci: "devtools",
  coder: "devtools",
  docker: "devtools",
  github: "devtools",
  gitlab: "devtools",
  hashicorp: "devtools",
  jetbrains: "devtools",
  launchdarkly: "devtools",
  merge: "devtools",
  neon: "devtools",
  posthog: "devtools",
  prefect: "devtools",
  redis: "devtools",
  replit: "devtools",
  resend: "devtools",
  retool: "devtools",
  sanity: "devtools",
  sentry: "devtools",
  sourcegraph: "devtools",
  supabase: "devtools",
  vercel: "devtools",
  watershed: "devtools",

  // cybersecurity
  "1password": "cybersecurity",
  crowdstrike: "cybersecurity",
  drata: "cybersecurity",
  hackerone: "cybersecurity",
  okta: "cybersecurity",
  "palo-alto-networks": "cybersecurity",
  rubrik: "cybersecurity",
  sentinelone: "cybersecurity",
  snyk: "cybersecurity",
  splunk: "cybersecurity",
  tanium: "cybersecurity",
  vanta: "cybersecurity",
  verkada: "cybersecurity",
  wiz: "cybersecurity",
  zscaler: "cybersecurity",

  // defense
  anduril: "defense",
  "bae-systems": "defense",
  boeing: "defense",
  "general-dynamics": "defense",
  "l3harris": "defense",
  leidos: "defense",
  "lockheed-martin": "defense",
  "northrop-grumman": "defense",
  palantir: "defense",
  rtx: "defense",
  "shield-ai": "defense",

  // space
  astranis: "space",
  "blue-origin": "space",
  hermeus: "space",
  "planet-labs": "space",
  relativity: "space",
  "rocket-lab": "space",
  spacex: "space",
  "varda-space": "space",

  // aviation
  "joby-aviation": "aviation",

  // automotive
  carvana: "automotive",
  chargepoint: "automotive",
  "lucid-motors": "automotive",
  rivian: "automotive",
  tesla: "automotive",

  // autonomous-vehicles
  "applied-intuition": "autonomous-vehicles",
  aurora: "autonomous-vehicles",
  nuro: "autonomous-vehicles",
  waymo: "autonomous-vehicles",
  wayve: "autonomous-vehicles",
  zoox: "autonomous-vehicles",

  // robotics
  "figure-ai": "robotics",

  // drones
  skydio: "drones",

  // quant
  "akuna-capital": "quant",
  aqr: "quant",
  "aquatic-capital": "quant",
  balyasny: "quant",
  "belvedere-trading": "quant",
  "chicago-trading-company": "quant",
  citadel: "quant",
  "citadel-securities": "quant",
  "de-shaw": "quant",
  drw: "quant",
  "five-rings": "quant",
  "flow-traders": "quant",
  "headlands-technology": "quant",
  "hudson-river-trading": "quant",
  imc: "quant",
  "jane-street": "quant",
  "jump-trading": "quant",
  "maven-securities": "quant",
  millennium: "quant",
  "old-mission": "quant",
  optiver: "quant",
  peak6: "quant",
  point72: "quant",
  quantlab: "quant",
  "radix-trading": "quant",
  schonfeld: "quant",
  sig: "quant",
  "teza-technologies": "quant",
  "tower-research": "quant",
  "two-sigma": "quant",
  virtu: "quant",
  voloridge: "quant",
  "wolverine-trading": "quant",
  worldquant: "quant",
  "xtx-markets": "quant",

  // gaming
  "electronic-arts": "gaming",
  "epic-games": "gaming",
  "riot-games": "gaming",
  roblox: "gaming",
  scopely: "gaming",
  "take-two": "gaming",
  twitch: "gaming",
  unity: "gaming",
  valve: "gaming",

  // streaming
  netflix: "streaming",
  spotify: "streaming",

  // social
  discord: "social",
  nextdoor: "social",
  pinterest: "social",
  reddit: "social",
  snap: "social",
  tiktok: "social",
  bytedance: "social",

  // marketplaces
  airbnb: "marketplaces",
  etsy: "marketplaces",
  faire: "marketplaces",
  thumbtack: "marketplaces",

  // on-demand
  bird: "on-demand",
  doordash: "on-demand",
  gopuff: "on-demand",
  grubhub: "on-demand",
  instacart: "on-demand",
  lyft: "on-demand",
  uber: "on-demand",

  // ecommerce
  chewy: "ecommerce",
  "rent-the-runway": "ecommerce",
  squarespace: "ecommerce",
  "stitch-fix": "ecommerce",
  wayfair: "ecommerce",
  zillow: "ecommerce",

  // enterprise-software
  attentive: "enterprise-software",
  "bill-com": "enterprise-software",
  flexport: "enterprise-software",
  hubspot: "enterprise-software",
  ibm: "enterprise-software",
  intercom: "enterprise-software",
  klaviyo: "enterprise-software",
  linkedin: "enterprise-software",
  oracle: "enterprise-software",
  salesforce: "enterprise-software",
  sap: "enterprise-software",
  samsara: "enterprise-software",
  servicenow: "enterprise-software",
  shopify: "enterprise-software",
  toast: "enterprise-software",
  "uber-freight": "enterprise-software",
  workato: "enterprise-software",
  workday: "enterprise-software",
  yext: "enterprise-software",
  zendesk: "enterprise-software",

  // productivity
  adobe: "productivity",
  airtable: "productivity",
  asana: "productivity",
  atlassian: "productivity",
  autodesk: "productivity",
  calendly: "productivity",
  canva: "productivity",
  clay: "productivity",
  figma: "productivity",
  intuit: "productivity",
  ironclad: "productivity",
  linear: "productivity",
  loom: "productivity",
  notion: "productivity",
  zip: "productivity",

  // hr-tech
  deel: "hr-tech",
  gusto: "hr-tech",
  rippling: "hr-tech",

  // healthtech
  "clover-health": "healthtech",
  oscar: "healthtech",

  // consumer-tech
  coursera: "consumer-tech",
  dropbox: "consumer-tech",
  duolingo: "consumer-tech",
  glossier: "consumer-tech",
  oura: "consumer-tech",
  peloton: "consumer-tech",
  tripadvisor: "consumer-tech",
};

const catalogSlugs = new Set(CATALOG.map(([slug]) => slug));
const companySlugs = Object.keys(COMPANY_INDUSTRY);

for (const slug of companySlugs) {
  if (!catalogSlugs.has(COMPANY_INDUSTRY[slug])) {
    throw new Error(`Unknown industry "${COMPANY_INDUSTRY[slug]}" for ${slug}`);
  }
}

if (companySlugs.length !== 335) {
  throw new Error(`Expected 335 company mappings, got ${companySlugs.length}`);
}

const catalogValues = CATALOG.map(
  ([slug, label, description, sort_order]) =>
    `  ('${slug}', '${label.replace(/'/g, "''")}', '${description.replace(/'/g, "''")}', ${sort_order})`,
).join(",\n");

const valueRows = Object.entries(COMPANY_INDUSTRY)
  .map(([slug, industry]) => `  ('${slug}', '${industry}')`)
  .join(",\n");

const updates = `alter table public.companies drop constraint if exists companies_industry_check;

-- Reclassify mapped companies, then normalize any stragglers.
update public.companies as c
set
  industry = m.industry,
  updated_at = now()
from (
  values
${valueRows}
) as m(slug, industry)
where c.slug = m.slug;

update public.companies
set industry = 'enterprise-software', updated_at = now()
where industry is null
   or industry not in (select slug from public.discover_industries);`;

const sql = `-- Discover industry catalog (canonical taxonomy) and company backfill.
-- Replaces free-text industry values and in-app slug maps.

create table public.discover_industries (
  slug text primary key,
  label text not null,
  description text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint discover_industries_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

insert into public.discover_industries (slug, label, description, sort_order)
values
${catalogValues}
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

${updates}

alter table public.companies drop constraint if exists companies_industry_fkey;

alter table public.companies
  alter column industry set default 'enterprise-software';

alter table public.companies
  add constraint companies_industry_fkey
  foreign key (industry) references public.discover_industries (slug);

alter table public.discover_industries enable row level security;

drop policy if exists discover_industries_select_authenticated on public.discover_industries;
create policy discover_industries_select_authenticated
  on public.discover_industries
  for select
  to authenticated
  using (true);

grant select on public.discover_industries to authenticated;
`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "supabase/migrations/177_discover_industries_catalog.sql");
writeFileSync(outPath, sql);
console.log(`Wrote ${outPath} (${companySlugs.length} companies, ${CATALOG.length} industries)`);
