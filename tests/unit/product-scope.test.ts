import assert from "node:assert/strict";
import test from "node:test";

import {
  feedPostingMatchesProductScope,
  locationFieldMatchesProductScope,
  postingMatchesProductScope,
  scrapedPostingRowMatchesProductScope,
} from "@/lib/feed/product-scope";

test("product scope keeps US-only postings", () => {
  assert.equal(postingMatchesProductScope(["US"], ["San Francisco, CA"]), true);
  assert.equal(feedPostingMatchesProductScope({ countries: ["US"], locations: ["San Francisco, CA"] }), true);
});

test("product scope keeps multi-location postings when any site is US", () => {
  assert.equal(
    postingMatchesProductScope(["US", "GB"], ["New York, NY", "London, UK"]),
    true,
  );
  assert.equal(
    scrapedPostingRowMatchesProductScope({
      countries: ["US", "GB"],
      location: "New York, NY / London, UK",
      location_places: null,
    }),
    true,
  );
});

test("product scope drops non-US postings", () => {
  assert.equal(postingMatchesProductScope(["GB"], ["London, UK"]), false);
  assert.equal(locationFieldMatchesProductScope("London, UK"), false);
  assert.equal(
    scrapedPostingRowMatchesProductScope({
      countries: ["CA"],
      location: "Toronto, ON, Canada",
      location_places: null,
    }),
    false,
  );
});

test("product scope drops postings with unknown country", () => {
  assert.equal(postingMatchesProductScope([], ["Remote"]), false);
  assert.equal(locationFieldMatchesProductScope("Remote"), false);
});
