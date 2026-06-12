/**
 * Dev-only: download GeoNames cities15000 + merge aliases, emit lib/geo/data/cities.json.
 *
 *   npm run build:gazetteer
 */
import { createWriteStream, readFileSync, mkdirSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { get as httpsGet } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "lib/geo/data");
const citiesOut = path.join(dataDir, "cities.json");
const aliasesPath = path.join(dataDir, "aliases.json");

const GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip";
/** cities15000 floor; the old 50k cut dropped HQ towns like Foster City and Menlo Park. */
const MIN_POPULATION = 15_000;

type CityEntry = {
  name: string;
  region: string | null;
  country: string;
  population: number;
  lat: number;
  lng: number;
};

type AliasEntry = {
  city: string;
  region?: string;
  country: string;
};

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    httpsGet(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirect = response.headers.location;
        if (!redirect) {
          reject(new Error("Redirect without location"));
          return;
        }
        file.close();
        download(redirect, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", reject);
  });
}

async function parseCities15000(zipPath: string): Promise<CityEntry[]> {
  const { execSync } = await import("node:child_process");
  const tmpTxt = path.join(dataDir, "cities15000.txt");
  execSync(`unzip -p "${zipPath}" cities15000.txt > "${tmpTxt}"`, { stdio: "inherit" });

  const cities: CityEntry[] = [];
  const rl = createInterface({ input: createReadStream(tmpTxt), crlfDelay: Infinity });

  for await (const line of rl) {
    const cols = line.split("\t");
    if (cols.length < 15) continue;
    const name = cols[1]?.trim();
    const country = cols[8]?.trim().toUpperCase();
    const admin1 = cols[10]?.trim() || null;
    const lat = Number.parseFloat(cols[4] ?? "");
    const lng = Number.parseFloat(cols[5] ?? "");
    const population = Number.parseInt(cols[14] ?? "0", 10) || 0;
    if (!name || !country || population < MIN_POPULATION) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    cities.push({ name, region: admin1 || null, country, population, lat, lng });
  }

  return cities;
}

function mergeAliases(cities: CityEntry[], aliases: Record<string, AliasEntry>): CityEntry[] {
  const seen = new Set(cities.map((c) => `${c.name.toLowerCase()}|${c.country}|${c.region ?? ""}`));
  const merged = [...cities];

  for (const entry of Object.values(aliases)) {
    const key = `${entry.city.toLowerCase()}|${entry.country}|${entry.region ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      name: entry.city,
      region: entry.region ?? null,
      country: entry.country,
      population: 0,
      lat: 0,
      lng: 0,
    });
  }

  return merged.sort((a, b) => b.population - a.population);
}

async function main() {
  mkdirSync(dataDir, { recursive: true });
  const zipPath = path.join(dataDir, "cities15000.zip");

  if (!existsSync(zipPath)) {
    console.log("Downloading GeoNames cities15000...");
    await download(GEONAMES_URL, zipPath);
  }

  console.log("Parsing cities15000...");
  const cities = await parseCities15000(zipPath);
  const aliases = JSON.parse(readFileSync(aliasesPath, "utf8")) as Record<string, AliasEntry>;
  const merged = mergeAliases(cities, aliases);

  const payload = { generatedAt: new Date().toISOString(), count: merged.length, cities: merged };
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(citiesOut, `${JSON.stringify(payload)}\n`),
  );

  console.log(`Wrote ${merged.length} cities to ${citiesOut}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
