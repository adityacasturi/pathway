/**
 * Replace legacy dedupe+return blocks with buildRoleParseResult in adapters.
 *
 *   node scripts/normalize-adapter-parse-returns.mjs --write
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const write = process.argv.includes("--write");
const dir = join(import.meta.dirname, "../lib/scraping/adapters");

const returnRe =
  /const deduped = dedupe(?:Roles)?ByPostingUrl\(roles\);\s*return \{\s*roles: deduped,\s*stats: \{\s*fetched: ([^,]+),\s*kept: deduped\.length,\s*rejected,\s*\},\s*\};/g;

let count = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
  const path = join(dir, file);
  let src = readFileSync(path, "utf8");
  if (!returnRe.test(src)) {
    continue;
  }
  returnRe.lastIndex = 0;

  let next = src;
  if (!next.includes('from "../role-parse-result.ts"') && next.includes("buildScrapedRole")) {
    next = next.replace(
      /import { buildScrapedRole } from "\.\.\/scraped-role-build\.ts";/,
      `import { buildScrapedRole } from "../scraped-role-build.ts";\nimport { buildRoleParseResult } from "../role-parse-result.ts";`,
    );
  }

  next = next.replace(returnRe, "return buildRoleParseResult($1, roles, rejected);");
  if (next !== src) {
    count += 1;
    console.log(write ? "fixed" : "would fix", file);
    if (write) {
      writeFileSync(path, next);
    }
  }
}

console.log(`${count} file(s)`);
