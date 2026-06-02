import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const adaptersDir = join(import.meta.dirname, "../lib/scraping/adapters");

for (const file of readdirSync(adaptersDir).filter((f) => f.endsWith(".ts"))) {
  const path = join(adaptersDir, file);
  let src = readFileSync(path, "utf8");
  if (!src.includes("roles.push({") || !src.includes("buildScrapedRole")) {
    continue;
  }

  const re =
    /roles\.push\(\{\s*postingUrl,\s*roleName,\s*companyName: source\.companyName,\s*season: inferSeason\(([^)]+)\),[\s\S]*?dates: ([\s\S]*?),\s*\}\);/g;

  let next = src.replace(re, (match, seasonArg, datesExpr) => {
    const before = src.slice(0, src.indexOf(match));
    const descMatch = before.match(/const description(?:Parts)? = ([^;]+);/g);
    const lastDesc = descMatch?.at(-1)?.match(/const description(?:Parts)? = ([^;]+);/)?.[1];
    const descriptionExpr = lastDesc?.trim() || '""';
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

  if (next !== src) {
    writeFileSync(path, next);
    console.log("fixed", file);
  }
}
