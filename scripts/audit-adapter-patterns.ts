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
  exportsAdapter: boolean;
  delegatesParsing: boolean;
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
    exportsAdapter: /export function create[A-Z][A-Za-z0-9]*Adapter\(/.test(src),
    delegatesParsing:
      /create(?:Filtered)?[A-Z][A-Za-z0-9]*Adapter\(/.test(src) ||
      /\bparse(?:Workday|Salesforce|Greenhouse|Microsoft)Jobs?\(/.test(src) ||
      /\bparseWorkdayPostings\(/.test(src),
    usesBuildScrapedRole: src.includes("buildScrapedRole"),
    usesBuildRoleParseResult: src.includes("buildRoleParseResult"),
    usesClassify: src.includes("classifyScrapeRole"),
    unknownDates: src.includes("unknownScrapedDates"),
    handBuiltRoles: /roles\.push\(\{[\s\S]*?postingUrl/.test(src),
  });
}

const adapterRows = rows.filter((r) => r.exportsAdapter);
const needsMigrate = adapterRows.filter(
  (r) =>
    !r.delegatesParsing &&
    (!r.usesBuildScrapedRole || r.handBuiltRoles || !r.usesBuildRoleParseResult),
);

console.log(
  "adapter\tkind\tbuildScrapedRole\tbuildRoleParseResult\tclassify\tunknownDates\thandBuilt",
);
for (const r of rows) {
  console.log(
    [
      r.file,
      r.exportsAdapter ? (r.delegatesParsing ? "delegated" : "parser") : "support",
      r.usesBuildScrapedRole ? "yes" : "NO",
      r.usesBuildRoleParseResult ? "yes" : "NO",
      r.usesClassify ? "yes" : "NO",
      r.unknownDates ? "yes" : "-",
      r.handBuiltRoles ? "yes" : "-",
    ].join("\t"),
  );
}

console.log(
  `\n${adapterRows.length} adapter factories; ${needsMigrate.length} parser adapters still hand-roll roles or skip shared parse helpers.`,
);
