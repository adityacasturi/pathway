/**
 * Mechanical migration: use buildScrapedRole + buildRoleParseResult in adapters
 * that still hand-build role rows after classifyScrapeRole.
 *
 *   node scripts/migrate-adapters-to-build-scraped-role.mjs
 *   node scripts/migrate-adapters-to-build-scraped-role.mjs --write
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const write = process.argv.includes("--write");
const adaptersDir = join(import.meta.dirname, "../lib/scraping/adapters");
const skip = new Set(["shared.ts", "greenhouse.ts", "ashby.ts", "lever.ts", "workday.ts", "coinbase.ts"]);

const pushBlockRe =
  /roles\.push\(\{\s*postingUrl,\s*roleName,\s*companyName: source\.companyName,\s*season: inferSeason\(([^)]+)\),\s*location,?\s*datePosted: null,\s*dates: ([\s\S]*?),\s*\}\);/g;

let changed = 0;

for (const file of readdirSync(adaptersDir).filter((f) => f.endsWith(".ts") && !skip.has(f))) {
  const path = join(adaptersDir, file);
  let src = readFileSync(path, "utf8");
  if (!src.includes("roles.push({") || src.includes("buildScrapedRole")) {
    continue;
  }
  if (!src.includes("classifyScrapeRole")) {
    continue;
  }

  let next = src;

  if (!next.includes('from "../scraped-role-build.ts"')) {
    next = next.replace(
      /import { classifyScrapeRole } from "\.\.\/classify-role\.ts";/,
      `import { classifyScrapeRole } from "../classify-role.ts";\nimport { buildScrapedRole } from "../scraped-role-build.ts";\nimport { buildRoleParseResult } from "../role-parse-result.ts";`,
    );
  }

  next = next.replace(/const roles: ScrapedRole\[\] = \[\];/g, "const roles: ReturnType<typeof buildScrapedRole>[] = [];");

  next = next.replace(pushBlockRe, (_, seasonArgs, datesExpr) => {
    const descriptionMatch = next.match(
      new RegExp(
        `const description = ([^;]+);[\\s\\S]*?roles\\.push\\(\\{[\\s\\S]*?season: inferSeason\\(${seasonArgs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`,
      ),
    );
    const descriptionExpr = descriptionMatch?.[1]?.trim() || '""';
    return `roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: ${descriptionExpr},
        dates: ${datesExpr.trim()},
      }),
    );`;
  });

  next = next.replace(
    /const deduped = dedupeByPostingUrl\(roles\);\s*return \{\s*roles: deduped,\s*stats: \{\s*fetched: ([^,]+),\s*kept: deduped\.length,\s*rejected,\s*\},\s*\};/g,
    "return buildRoleParseResult($1, roles, rejected);",
  );

  if (next !== src) {
    changed += 1;
    console.log(write ? "updated" : "would update", file);
    if (write) {
      writeFileSync(path, next);
    }
  }
}

console.log(`${changed} adapter file(s) ${write ? "updated" : "matched"}; re-run with --write to apply.`);
