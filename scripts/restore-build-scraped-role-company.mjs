import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../lib/scraping/adapters");
let count = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
  const path = join(dir, file);
  let src = readFileSync(path, "utf8");
  if (!src.includes("buildScrapedRole({")) {
    continue;
  }

  const next = src.replace(
    /buildScrapedRole\(\{(\s*)(?:postingUrl: [^,]+|postingUrl,\s*\n\s*roleName[^,]+,)\s*\n\s*roleName[^,]*,?\s*\n(?!\s*companyName)/g,
    (match, indent) => {
      if (match.includes("companyName")) {
        return match;
      }
      return match.replace(
        /roleName,?\s*\n/,
        `roleName,\n${indent}companyName: source.companyName,\n${indent}companySlug: source.companySlug,\n`,
      );
    },
  );

  // Simpler pass: insert after roleName line when companyName missing in block
  const fixed = next.replace(
    /(buildScrapedRole\(\{[\s\S]*?roleName(?:[^,\n]+|,)[^\n]*\n)(\s*)(?!companyName)/g,
    (full, prefix, indent) => {
      if (full.includes("companyName:")) {
        return full;
      }
      return `${prefix}${indent}companyName: source.companyName,\n${indent}companySlug: source.companySlug,\n${indent}`;
    },
  );

  if (fixed !== src) {
    count += 1;
    writeFileSync(path, fixed);
    console.log("fixed", file);
  }
}

console.log(count);
