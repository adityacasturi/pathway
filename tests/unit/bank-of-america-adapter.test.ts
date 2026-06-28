import assert from "node:assert/strict";
import test from "node:test";
import {
  BOFA_CAMPUS_CANDIDATE_HOME,
  parseBofaJobboardListingsHtml,
  parseBofaJobboardUrls,
  parseBofaJobDetailFields,
} from "../../lib/scraping/adapters/bank-of-america.ts";

test("parseBofaJobboardUrls discovers campus jobboards from candidate home", () => {
  const html = `
    <a href="https://bankcampuscareers.tal.net/vx/lang-en-GB/mobile-0/brand-4/xf-abc/candidate/jobboard/vacancy/1/adv/">Programs</a>
    <a href="https://bankcampuscareers.tal.net/vx/lang-en-GB/mobile-0/brand-4/xf-abc/candidate/jobboard/vacancy/2/adv/">Events</a>
  `;
  assert.deepEqual(parseBofaJobboardUrls(html), [
    "https://bankcampuscareers.tal.net/vx/lang-en-GB/mobile-0/brand-4/xf-abc/candidate/jobboard/vacancy/1/adv/",
    "https://bankcampuscareers.tal.net/vx/lang-en-GB/mobile-0/brand-4/xf-abc/candidate/jobboard/vacancy/2/adv/",
  ]);
});

test("parseBofaJobboardListingsHtml extracts opportunity links", () => {
  const html = `
    <tr class="opp_14089 search_res details_row" data-title="Global Technology Summer Analyst - Sydney">
      <td class="comm_list_tbody">
        <a class="subject" href="https://bankcampuscareers.tal.net/vx/example/candidate/so/pm/1/pl/1/opp/14089-Global-Technology-Summer-Analyst/en-GB">
          Global Technology Summer Analyst - Sydney
        </a>
      </td>
      <td class="comm_list_tbody">Sydney</td>
    </tr>
  `;
  const listings = parseBofaJobboardListingsHtml(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0]?.title, "Global Technology Summer Analyst - Sydney");
  assert.equal(listings[0]?.location, "Sydney");
});

test("parseBofaJobDetailFields reads title, city, and program description", () => {
  const html = `
    <title>Global Technology Summer Analyst - Sydney - Bank of America</title>
    <meta name="description" content="Program ID: 14089. Title: Global Technology Summer Analyst - Sydney. City: Sydney" />
    <span class="hform_lbl_text">Program description</span>
    <div class="form-control-static"><p>Build core infrastructure platforms.</p></div>
  `;
  const detail = parseBofaJobDetailFields(html);
  assert.equal(detail.title, "Global Technology Summer Analyst - Sydney");
  assert.equal(detail.location, "Sydney");
  assert.match(detail.description, /core infrastructure/i);
});

test("BOFA_CAMPUS_CANDIDATE_HOME points at campus portal", () => {
  assert.equal(BOFA_CAMPUS_CANDIDATE_HOME, "https://bankcampuscareers.tal.net/candidate");
});
