/**
 * Static adapter hygiene report (no network).
 *
 *   node --disable-warning=ExperimentalWarning --experimental-strip-types \
 *     --experimental-specifier-resolution=node scripts/audit-adapter-patterns.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const adaptersDir = join(import.meta.dirname, "../lib/scraping/adapters");
const files = readdirSync(adaptersDir)
  .filter((name) => name.endsWith(".ts") && name !== "shared.ts")
  .sort();

type Row = {
  file: string;
  usesBuildScrapedRole: boolean;
  usesBuildRoleParseResult: boolean;
  usesClassify: boolean;
  unknownDates: boolean;
  handBuiltRoles: boolean;
};

const rows: Row[] = [];

for (const file of files) {
  const path = join(adaptersDir, file);
  const src = readFileSync(path, "utf8");
  rows.push({
    file: file.replace(/\.ts$/, ""),
    usesBuildScrapedRole: src.includes("buildScrapedRole"),
    usesBuildRoleParseResult: src.includes("buildRoleParseResult"),
    usesClassify: src.includes("classifyScrapeRole"),
    unknownDates: src.includes("unknownScrapedDates"),
    handBuiltRoles: /roles\.push\(\{[\s\S]*?postingUrl/.test(src),
  });
}

const needsMigrate = rows.filter(
  (r) => !r.usesBuildScrapedRole || r.handBuiltRoles || !r.usesBuildRoleParseResult,
);

console.log("adapter\ttbuildScrapedRole\tbuildRoleParseResult\tclassify\tunknownDates\thandBuilt");
for (const r of rows) {
  console.log(
    [
      r.file,
      r.usesBuildScrapedRole ? "yes" : "NO",
      r.usesBuildRoleParseResult ? "yes" : "NO",
      r.usesClassify ? "yes" : "NO",
      r.unknownDates ? "yes" : "-",
      r.handBuiltRoles ? "yes" : "-",
    ].join("\t"),
  );
}

console.log(`\n${rows.length} adapters; ${needsMigrate.length} still hand-roll roles or skip shared parse helpers.`);
