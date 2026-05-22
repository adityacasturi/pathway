import type { QueueCompany } from "./integration-queue.ts";

/**
 * Initial backlog toward ~500 FAANG+ targets.
 * Queue input is company name (+ slug); automation discovers careers URL and ATS.
 * Optional `careersUrl` / `domain` only for manual overrides on hard cases.
 */
export const PENDING_INTEGRATION_SEEDS: Omit<
  QueueCompany,
  "status" | "claimedAt" | "claimedBy" | "completedAt" | "lastVerifiedAt" | "postingsFound"
>[] = [
  // Tier C — custom careers (human-primed; autoApprove false)
  { slug: "apple", name: "Apple", tier: "custom", priority: 1, autoApprove: false, careersUrl: "https://jobs.apple.com" },
  { slug: "google", name: "Google", tier: "custom", priority: 2, autoApprove: false, careersUrl: "https://www.google.com/about/careers/applications" },
  { slug: "meta", name: "Meta", tier: "custom", priority: 3, autoApprove: false },
  { slug: "microsoft", name: "Microsoft", tier: "custom", priority: 4, autoApprove: false },
  { slug: "tesla", name: "Tesla", tier: "custom", priority: 5, autoApprove: false },
  { slug: "citadel", name: "Citadel", tier: "custom", priority: 6, autoApprove: false },
  { slug: "netflix", name: "Netflix", tier: "custom", priority: 7, autoApprove: false },
  { slug: "uber", name: "Uber", tier: "custom", priority: 8, autoApprove: false },
  { slug: "lyft", name: "Lyft", tier: "custom", priority: 9, autoApprove: false },
  { slug: "doordash", name: "DoorDash", tier: "custom", priority: 10, autoApprove: false },
  { slug: "salesforce", name: "Salesforce", tier: "custom", priority: 11, autoApprove: false },
  { slug: "adobe", name: "Adobe", tier: "custom", priority: 12, autoApprove: false },
  { slug: "oracle", name: "Oracle", tier: "custom", priority: 13, autoApprove: false },
  { slug: "ibm", name: "IBM", tier: "custom", priority: 14, autoApprove: false },
  { slug: "intel", name: "Intel", tier: "custom", priority: 15, autoApprove: false },
  { slug: "amd", name: "AMD", tier: "custom", priority: 16, autoApprove: false },
  { slug: "qualcomm", name: "Qualcomm", tier: "custom", priority: 17, autoApprove: false },
  { slug: "jane-street", name: "Jane Street", tier: "custom", priority: 18, autoApprove: false, notes: "Adapter exists; queue entry for verify/sync only" },

  // Quant / trading — discover on claim
  { slug: "two-sigma", name: "Two Sigma", tier: "discover", priority: 20, autoApprove: false },
  { slug: "hudson-river-trading", name: "Hudson River Trading", tier: "discover", priority: 21, autoApprove: false },
  { slug: "de-shaw", name: "DE Shaw", tier: "discover", priority: 22, autoApprove: false },
  { slug: "jump-trading", name: "Jump Trading", tier: "discover", priority: 23, autoApprove: false },
  { slug: "virtu", name: "Virtu Financial", tier: "discover", priority: 24, autoApprove: false },
  { slug: "imc", name: "IMC", tier: "discover", priority: 25, autoApprove: false },
  { slug: "akuna", name: "Akuna Capital", tier: "discover", priority: 26, autoApprove: false },
  { slug: "citadel-securities", name: "Citadel Securities", tier: "discover", priority: 27, autoApprove: false },
  { slug: "millennium", name: "Millennium", tier: "discover", priority: 28, autoApprove: false },
  { slug: "point72", name: "Point72", tier: "discover", priority: 29, autoApprove: false },

  // Tier A — name only; hourly automation discovers careers + ATS
  { slug: "databricks", name: "Databricks", tier: "discover", priority: 40, autoApprove: true, notes: "Often done via migration sync" },
  { slug: "snowflake", name: "Snowflake", tier: "discover", priority: 41, autoApprove: true },
  { slug: "mongodb", name: "MongoDB", tier: "discover", priority: 42, autoApprove: true },
  { slug: "cloudflare", name: "Cloudflare", tier: "discover", priority: 43, autoApprove: true },
  { slug: "pinterest", name: "Pinterest", tier: "discover", priority: 44, autoApprove: true },
  { slug: "snap", name: "Snap", tier: "discover", priority: 45, autoApprove: true },
  { slug: "block", name: "Block", tier: "discover", priority: 46, autoApprove: true },
  { slug: "instacart", name: "Instacart", tier: "discover", priority: 47, autoApprove: true },
  { slug: "hubspot", name: "HubSpot", tier: "discover", priority: 48, autoApprove: true },
  { slug: "twilio", name: "Twilio", tier: "discover", priority: 49, autoApprove: true },
  { slug: "okta", name: "Okta", tier: "discover", priority: 50, autoApprove: true },
  { slug: "elastic", name: "Elastic", tier: "discover", priority: 51, autoApprove: true },
  { slug: "gitlab", name: "GitLab", tier: "discover", priority: 52, autoApprove: true },
  { slug: "hashicorp", name: "HashiCorp", tier: "discover", priority: 53, autoApprove: true },
  { slug: "confluent", name: "Confluent", tier: "discover", priority: 54, autoApprove: true },
  { slug: "cockroach-labs", name: "Cockroach Labs", tier: "discover", priority: 55, autoApprove: true },
  { slug: "scale-ai", name: "Scale AI", tier: "discover", priority: 56, autoApprove: true },
  { slug: "anduril", name: "Anduril", tier: "discover", priority: 57, autoApprove: true },
  { slug: "palantir", name: "Palantir", tier: "discover", priority: 58, autoApprove: true, notes: "May already exist in DB from 050" },
  { slug: "spotify", name: "Spotify", tier: "discover", priority: 59, autoApprove: true },
  { slug: "cruise", name: "Cruise", tier: "discover", priority: 60, autoApprove: true },
  { slug: "waymo", name: "Waymo", tier: "discover", priority: 61, autoApprove: true },
  { slug: "rivian", name: "Rivian", tier: "discover", priority: 62, autoApprove: true },
  { slug: "figma", name: "Figma", tier: "discover", priority: 63, autoApprove: true, notes: "May already exist in DB" },

  // Tier B — discover on manual claim
  { slug: "spacex", name: "SpaceX", tier: "discover", priority: 70, autoApprove: false },
  { slug: "tiktok", name: "TikTok", tier: "discover", priority: 71, autoApprove: false },
  { slug: "bytedance", name: "ByteDance", tier: "discover", priority: 72, autoApprove: false },
  { slug: "shopify", name: "Shopify", tier: "discover", priority: 73, autoApprove: false },
  { slug: "squarespace", name: "Squarespace", tier: "discover", priority: 74, autoApprove: false },
  { slug: "toast", name: "Toast", tier: "discover", priority: 75, autoApprove: false },
  { slug: "sofi", name: "SoFi", tier: "discover", priority: 76, autoApprove: false },
  { slug: "chime", name: "Chime", tier: "discover", priority: 77, autoApprove: false },
  { slug: "affirm", name: "Affirm", tier: "discover", priority: 78, autoApprove: false },
  { slug: "marqeta", name: "Marqeta", tier: "discover", priority: 79, autoApprove: false },
  { slug: "carta", name: "Carta", tier: "discover", priority: 80, autoApprove: false },
  { slug: "rippling", name: "Rippling", tier: "discover", priority: 81, autoApprove: false },
  { slug: "glean", name: "Glean", tier: "discover", priority: 82, autoApprove: false },
  { slug: "cohere", name: "Cohere", tier: "discover", priority: 83, autoApprove: false },
  { slug: "mistral", name: "Mistral", tier: "discover", priority: 84, autoApprove: false },
  { slug: "xai", name: "xAI", tier: "discover", priority: 85, autoApprove: false },
  { slug: "character-ai", name: "Character.AI", tier: "discover", priority: 86, autoApprove: false },
];
