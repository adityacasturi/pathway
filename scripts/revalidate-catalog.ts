import { resolve } from "node:path";
import { readFileSync } from "node:fs";

loadDotEnvLocal();

const secret = process.env.CATALOG_REVALIDATE_SECRET?.trim();
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

if (!secret || !siteUrl) {
  console.log("Skip catalog revalidation (CATALOG_REVALIDATE_SECRET or NEXT_PUBLIC_SITE_URL unset).");
  process.exit(0);
}

const response = await fetch(`${siteUrl}/api/revalidate-catalog`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

if (!response.ok) {
  const body = await response.text();
  console.error(`Catalog revalidation failed (${response.status}): ${body}`);
  process.exit(1);
}

console.log("Catalog cache tags invalidated.");

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional local env
  }
}
