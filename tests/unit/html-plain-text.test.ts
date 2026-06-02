import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeBrassRingEntities,
  decodeHtmlEntities,
  slugifyPostingTitle,
  stripHtml,
} from "../../lib/scraping/html-utils.ts";
import { htmlToPlainText } from "../../lib/scraping/plain-text.ts";

test("htmlToPlainText strips tags and decodes entities", () => {
  assert.equal(
    htmlToPlainText("<p>Hello&nbsp;<strong>world</strong></p>"),
    "Hello world",
  );
  assert.equal(htmlToPlainText("&#x41;BC"), "ABC");
  assert.equal(htmlToPlainText("   "), "");
});

test("html utility aliases share plain-text behavior", () => {
  const html = "<div>Role &amp; team</div>";
  assert.equal(decodeHtmlEntities(html), "Role & team");
  assert.equal(stripHtml(html), decodeHtmlEntities(html));
  assert.equal(decodeBrassRingEntities(html), decodeHtmlEntities(html));
});

test("slugifyPostingTitle normalizes titles for URL segments", () => {
  assert.equal(slugifyPostingTitle("Software Engineer, Intern"), "software-engineer-intern");
  assert.equal(slugifyPostingTitle("---"), "role");
});
