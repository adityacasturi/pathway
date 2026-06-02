import assert from "node:assert/strict";
import test from "node:test";
import { detectCountriesAcross } from "../../lib/feed/location.ts";

test("detectCountriesAcross parses Greenhouse state-country glue", () => {
  assert.deepEqual(detectCountriesAcross(["San Mateo, CA United States"]), ["US"]);
  assert.deepEqual(detectCountriesAcross(["San Mateo, CA, United States"]), ["US"]);
  assert.deepEqual(detectCountriesAcross(["Toronto, ON Canada"]), ["CA"]);
});

test("detectCountriesAcross parses common US location strings", () => {
  assert.deepEqual(detectCountriesAcross(["San Francisco, CA"]), ["US"]);
  assert.deepEqual(detectCountriesAcross(["Remote US"]), ["US"]);
  assert.deepEqual(detectCountriesAcross(["Flexible - Any SpaceX Site"]), ["US"]);
  assert.deepEqual(detectCountriesAcross(["Paris, France"]), ["FR"]);
});
