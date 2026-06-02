/**
 * Use classifyForSource(source, …) in adapters that call classifyScrapeRole without company context.
 *
 *   node scripts/use-classify-for-source.mjs --write
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const write = process.argv.includes("--write");
const dir = join(import.meta.dirname, "../lib/scraping/adapters");
const skip = new Set(["shared.ts"]);

let count = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !skip.has(f))) {
  const path = join(dir, file);
  let src = readFileSync(path, "utf8");
  if (!src.includes("classifyScrapeRole(")) {
    continue;
  }
  if (src.includes("classifyForSource(")) {
    continue;
  }

  let next = src;
  if (!next.includes("classifyForSource")) {
    if (next.includes('from "../classify-role.ts"')) {
      next = next.replace(
        /import \{ classifyScrapeRole([^}]*)\} from "\.\.\/classify-role\.ts";/,
        `import { classifyForSource } from "../adapter-parse.ts";\nimport { classifyScrapeRole$1} from "../classify-role.ts";`,
      );
    } else {
      next = `import { classifyForSource } from "../adapter-parse.ts";\n${next}`;
    }
  }

  next = next.replace(/classifyScrapeRole\(\{/g, "classifyForSource(source, {");
  next = next.replace(
    /\n\s*companyName: source\.companyName,\s*\n\s*companySlug: source\.companySlug,?\s*\n/g,
    "\n",
  );

  if (next !== src) {
    count += 1;
    console.log(write ? "updated" : "would update", file);
    if (write) {
      writeFileSync(path, next);
    }
  }
}

console.log(`${count} file(s)`);
