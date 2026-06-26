import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSalesforcePostingUrl,
  parseSalesforceFeedEntry,
  parseSalesforceJobsFeed,
  slugifySalesforceJobTitle,
} from "@/lib/scraping/adapters/salesforce";

test("parseSalesforceFeedEntry maps Workday feed fields and builds posting URLs", () => {
  const job = parseSalesforceFeedEntry({
    Job_Requisition_Ref_ID: "JR346221",
    Job_Posting_Title: "Software Engineering Data Cloud Query / Hyper - PhD Intern",
    Job_Family_Group: "Software Engineering",
    Job_Description: "<p>PhD intern role.</p>",
    External_Job_Posting_Start_Date: "2026-03-01",
    Job_Requisition_Primary_Location: "Germany - Munich",
    Job_Requisition_Additional_Locations: "California - San Francisco; New York - New York",
    Time_Type: "Part time",
    Employee_Type: "Intern (Fixed Term)",
    External_Job_Posting_Site:
      "https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/job/Germany---Munich/Software-Engineering-Data-Cloud-Query---Hyper---PhD-Intern_JR346221",
  });

  assert.ok(job);
  assert.equal(job.jobPostingTitle, "Software Engineering Data Cloud Query / Hyper - PhD Intern");
  assert.equal(job.jobRequisitionPrimaryLocation, "Germany - Munich");
  assert.equal(
    buildSalesforcePostingUrl(job.jobRequisitionRefId, job.jobPostingTitle),
    "https://www.salesforce.com/company/careers/jobs/JR346221/software-engineering-data-cloud-query-hyper-phd-intern/",
  );
});

test("slugifySalesforceJobTitle matches careers site slug rules", () => {
  assert.equal(
    slugifySalesforceJobTitle("Software Engineering Data Cloud Query / Hyper - PhD Intern"),
    "software-engineering-data-cloud-query-hyper-phd-intern",
  );
});

test("parseSalesforceJobsFeed reads Report_Entry array", () => {
  const jobs = parseSalesforceJobsFeed(
    {
      Report_Entry: [
        {
          Job_Requisition_Ref_ID: "JR100001",
          Job_Posting_Title: "Futureforce Intern - Software Engineer",
          Job_Description: "Internship",
          External_Job_Posting_Start_Date: "2026-01-15",
          Job_Requisition_Primary_Location: "California - San Francisco",
        },
      ],
    },
    "https://a.sfdcstatic.com/digital/xsf/careers/prod/jobs_2.json",
  );

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.jobPostingTitle, "Futureforce Intern - Software Engineer");
});
