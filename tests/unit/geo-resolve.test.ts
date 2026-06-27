import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  formatCanonicalPlace,
  resolveLocationString,
  resolveScrapedLocations,
} from "../../lib/geo/server.ts";

const fixturesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/location-fixtures.json",
);

type LocationFixture = {
  input: string;
  expect: { display: string; countryCode: string };
};

const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8")) as LocationFixture[];

for (const fixture of fixtures) {
  test(`resolveLocationString: ${fixture.input}`, () => {
    const resolved = resolveLocationString(fixture.input);
    assert.ok(resolved, `expected resolution for ${fixture.input}`);
    assert.equal(formatCanonicalPlace(resolved!.place), fixture.expect.display);
    assert.equal(resolved!.place.countryCode, fixture.expect.countryCode);
  });
}

test("resolveScrapedLocations dedupes identical places", () => {
  const result = resolveScrapedLocations(["Singapore", "MSB, Singapore"]);
  assert.equal(result.places.length, 1);
  assert.equal(result.display, "Singapore");
});

test("resolveScrapedLocations joins multiple distinct places", () => {
  const result = resolveScrapedLocations(["Dublin, Ireland", "Singapore"]);
  assert.equal(result.places.length, 2);
  assert.match(result.display ?? "", /Dublin, Ireland/);
  assert.match(result.display ?? "", /Singapore/);
});

test("resolveScrapedLocations does not default unknown foreign region strings to US", () => {
  const examples = [
    "Banska Bystrica, Kosice, BRATISLAVA, Banskobystrický kraj, Košický kraj, Bratislavský kraj, Slovakia",
    "Belgium, Brussels Region, Brussels",
    "Latin America",
    "BELGRADE, Serbia",
  ];

  for (const location of examples) {
    const result = resolveScrapedLocations([location]);
    assert.equal(result.countries.includes("US"), false, location);
    assert.doesNotMatch(result.display ?? "", /United States/, location);
  }
});

test("resolveScrapedLocations removes stale appended United States from foreign locations", () => {
  const examples = [
    "Belgium, Brussels Region, Brussels, United States",
    "Banska Bystrica, Kosice, Bratislava, Banskobystrický Kraj, Košický Kraj, Bratislavský Kraj, Slovakia, United States",
    "Belgrade, Serbia, United States",
    "Bangpa-in, Phra Nakhon Si Ayutthaya, Thailand, United States",
    "Sa-01-riyadh-s1, United States",
    "Pl-warsaw, United States · Warsaw, 78, Poland",
    "Philippines, Cavite, Gtc, United States",
    "Philippines, Cavite, United States",
    "Bangalore, United States",
    "De-berlin-trion Building, United States · Berlin, 16, Germany",
    "Bogota, Colombia, United States",
    "Lithuania, United States",
    "Cordoba, Argentina, United States",
    "Romania, Timisoara, United States",
    "Prague, Czech Republic, United States",
    "Egypt, New Cairo, United States",
    "Budapest, Hungary, United States",
  ];

  for (const location of examples) {
    const result = resolveScrapedLocations([location]);
    assert.equal(result.countries.includes("US"), false, location);
    assert.doesNotMatch(result.display ?? "", /United States/, location);
  }
});

test("resolveScrapedLocations preserves multi-city lists across countries", () => {
  const result = resolveScrapedLocations(["London, NY, Miami"]);
  assert.equal(result.places.length, 3);
  assert.deepEqual(result.countries, ["GB", "US"]);
  assert.match(result.display ?? "", /London, United Kingdom/);
  assert.match(result.display ?? "", /Miami, FL, United States/);
});

test("resolveScrapedLocations treats comma-separated US state names as states", () => {
  const result = resolveScrapedLocations(["Colorado, Florida, Texas"]);
  assert.equal(result.places.length, 3);
  assert.deepEqual(result.countries, ["US"]);
  assert.equal(
    result.display,
    "Colorado, United States · Florida, United States · Texas, United States",
  );
});

test("ambiguous state-vs-country codes require corroboration", () => {
  // Known city in Israel → Israel, known city in Illinois → US.
  assert.deepEqual(resolveScrapedLocations(["Tel Aviv, IL"]).countries, ["IL"]);
  assert.deepEqual(resolveScrapedLocations(["Chicago, IL"]).countries, ["US"]);
  // Unknown city with an ambiguous code resolves to nothing, never a guess.
  assert.equal(resolveScrapedLocations(["Foosburg, IL"]).places.length, 0);
});

test("resolveScrapedLocations fails closed instead of assuming unknown locations are US", () => {
  const examples = [
    "Some Unknown City",
    "Remote",
    "Hybrid",
  ];

  for (const location of examples) {
    const result = resolveScrapedLocations([location]);
    assert.equal(result.countries.includes("US"), false, location);
    assert.doesNotMatch(result.display ?? "", /United States/, location);
  }
});

test("splitLocationInput handles ' or ' lists and parenthesized separator lists", () => {
  const orList = resolveScrapedLocations(["New York, London, or Paris"]);
  assert.equal(orList.countries.includes("US"), true);
  assert.equal(orList.countries.includes("GB"), true);
  assert.equal(orList.countries.includes("FR"), true);

  const parenList = resolveScrapedLocations(["Remote (United States | Canada)"]);
  assert.deepEqual(parenList.countries, ["CA", "US"]);

  const orPair = resolveScrapedLocations(["Beijing OR Shanghai"]);
  assert.deepEqual(orPair.countries, ["CN"]);
});

test("two-letter TitleCase noise like 'In' never resolves to a place", () => {
  const result = resolveScrapedLocations(["In"]);
  assert.equal(result.places.length, 0);
  assert.equal(result.display, null);
});

test("ambiguous province/country tails corroborate via gazetteer, never guess", () => {
  // NL must be the Netherlands when the city corroborates it…
  const amsterdam = resolveScrapedLocations(["Amsterdam, NL"]);
  assert.deepEqual(amsterdam.countries, ["NL"]);
  // …and an uncorroborated ambiguous tail stays an honest unknown.
  const unknown = resolveScrapedLocations(["Zzyzx Springs, IL"]);
  assert.equal(unknown.places.length, 0);
});

test("label-only structured inputs split multi-place lists like strings", () => {
  const result = resolveScrapedLocations([
    { rawLabel: "Remote (United States | Canada)", remote: true },
  ]);
  assert.deepEqual(result.countries, ["CA", "US"]);
  assert.ok(result.places.every((p) => p.remote));
});

test("city-region-country convention beats the province reading of an ambiguous tail", () => {
  const result = resolveScrapedLocations(["Middenmeer, NH, NL"]);
  assert.deepEqual(result.countries, ["NL"]);
});

test("user-assigned ISO codes are not countries", () => {
  const result = resolveScrapedLocations(["Springfield, ZZ"]);
  assert.equal(result.countries.includes("ZZ"), false);
});

test("resolveScrapedLocations infers US for SpaceX flexible-site labels", () => {
  const result = resolveScrapedLocations(["Flexible - Any SpaceX Site"], {
    companyName: "SpaceX",
    companySlug: "spacex",
  });
  assert.deepEqual(result.countries, ["US"]);
  assert.equal(result.display, "United States");
});

test("resolveScrapedLocations does not infer a country from generic flexible-site labels", () => {
  const result = resolveScrapedLocations(["Flexible - Any Site"]);
  assert.equal(result.places.length, 0);
  assert.deepEqual(result.countries, []);
});
