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
