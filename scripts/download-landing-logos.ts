/**
 * Download static PNGs for the landing OfferWall into public/company-logos/.
 * Requires LOGO_DEV_TOKEN in the environment (same as /api/logo).
 *
 * Usage: npm run landing-logos
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** slug → logo.dev domain (preferred) or company name fallback */
const LANDING_LOGOS: ReadonlyArray<{ slug: string; domain?: string; company?: string }> = [
  { slug: "google", domain: "google.com" },
  { slug: "meta", domain: "meta.com" },
  { slug: "amazon", domain: "amazon.com" },
  { slug: "microsoft", domain: "microsoft.com" },
  { slug: "apple", domain: "apple.com" },
  { slug: "nvidia", domain: "nvidia.com" },
  { slug: "stripe", domain: "stripe.com" },
  { slug: "databricks", domain: "databricks.com" },
  { slug: "jane-street", company: "Jane Street" },
  { slug: "hudson-river-trading", company: "Hudson River Trading" },
  { slug: "citadel", company: "Citadel" },
  { slug: "palantir", domain: "palantir.com" },
  { slug: "snowflake", domain: "snowflake.com" },
  { slug: "goldman-sachs", company: "Goldman Sachs" },
  { slug: "morgan-stanley", company: "Morgan Stanley" },
  { slug: "two-sigma", company: "Two Sigma" },
  { slug: "bloomberg", domain: "bloomberg.com" },
  { slug: "salesforce", domain: "salesforce.com" },
  { slug: "uber", domain: "uber.com" },
  { slug: "airbnb", domain: "airbnb.com" },
  { slug: "coinbase", domain: "coinbase.com" },
  { slug: "tesla", domain: "tesla.com" },
  { slug: "netflix", domain: "netflix.com" },
  { slug: "ramp", domain: "ramp.com" },
  { slug: "figma", domain: "figma.com" },
];

const SIZE = 512;
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/company-logos");

function logoDevUrl(entry: (typeof LANDING_LOGOS)[number], token: string): string {
  const params = `token=${encodeURIComponent(token)}&size=${SIZE}&format=png`;
  if (entry.domain) {
    return `https://img.logo.dev/${encodeURIComponent(entry.domain)}?${params}`;
  }
  if (entry.company) {
    return `https://img.logo.dev/name/${encodeURIComponent(entry.company)}?${params}`;
  }
  throw new Error(`No domain or company for slug ${entry.slug}`);
}

async function main() {
  const token = process.env.LOGO_DEV_TOKEN?.trim();
  if (!token) {
    console.error("LOGO_DEV_TOKEN is required (set in .env.local)");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  let failed = 0;
  for (const entry of LANDING_LOGOS) {
    const outPath = path.join(OUT_DIR, `${entry.slug}.png`);
    const url = logoDevUrl(entry, token);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`FAIL ${entry.slug}: HTTP ${res.status}`);
      failed += 1;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(outPath, buf);
    console.log(`OK ${entry.slug} (${buf.length} bytes)`);
  }

  if (failed > 0) {
    console.error(`${failed} logo(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
