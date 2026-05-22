# Cursor Automation: company integrations (50/day)

Hourly cloud agent that claims work from `docs/company-integration-queue.json`, verifies standard ATS companies, and **applies directly to Supabase** (no PR). Custom ATS still uses a PR.

## Throughput math

| Setting | Value |
|---------|--------|
| Daily target | 50 (`dailyTarget` in queue file) |
| Schedule | Every hour (`0 * * * *`) |
| Claim batch | 2 (`claimBatchSize`) |
| Runs × batch | 24 × 2 = **48/day** (raise batch to 3 or run extra manual claims to hit 50) |

To hit 50 exactly: set `claimBatchSize` to **3** in the queue JSON, or run `INTEGRATION_CLAIM_COUNT=3` in the automation environment.

## Test first (do this before hourly runs)

### A. Add secrets (not inside the automation form)

1. Open [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents) → **Secrets** tab (or configure a saved **Environment** for `pathway`).
2. Add **Runtime secret** (recommended): name `SUPABASE_SERVICE_ROLE_KEY`, value = Supabase service_role key.
3. If prompted, create/link an **Environment** for repo `adityacasturi/pathway` so automations inherit those secrets.

### B. Create the automation

1. [cursor.com/automations](https://cursor.com/automations) → **New automation**
2. **Trigger:** **Webhook** (test: run on demand) — *not* hourly cron yet. After save, use **Run** or POST the webhook URL once.
   - Alternative for later: **Scheduled** → cron `0 * * * *`
3. **Repository:** `pathway`, branch **`dev`**
4. **Tools:** none required (do **not** enable Open pull request for standard ATS)
5. Paste the prompt from §5 below
6. **Save** → **Run** / trigger webhook once
7. Expect Supabase rows + queue `done` (optional migration file on `dev` if `INTEGRATION_COMMIT_DEV=1`)
8. After a good test, edit trigger to **Scheduled** hourly (or keep webhook + trigger manually)

**Test automation prefill:** [Create TEST automation](https://cursor.com/automations/new?prefill=eyJuYW1lIjoiUGF0aHdheSBpbnRlZ3JhdGlvbnMgVEVTVCIsImRlc2NyaXB0aW9uIjoiTWFudWFsIG9ubHkuIE9uZSBjb21wYW55IHBlciBydW4uIFBScyB0byBkZXYuIiwid29ya2Zsb3ciOnsidHJpZ2dlcnMiOlt7InR5cGUiOiJtYW51YWwifV0sImdpdENvbmZpZyI6eyJiYXNlQnJhbmNoIjoiZGV2In0sInByb21wdCI6IlRFU1QgTU9ERTogUGF0aHdheSBjb21wYW55IGludGVncmF0aW9uLiBOZXZlciBwdXNoIHRvIG1haW4gb3IgZGV2IGRpcmVjdGx5LlxuXG4xKSBDbGFpbSBvbmUgY29tcGFueTpcbiAgIG5wbSBydW4gaW50ZWdyYXRpb246cXVldWUgLS0gY2xhaW0gLS1jb3VudCAxIC0tanNvblxuICAgSWYgY291bnQgaXMgMCwgZXhpdCB3aXRoIGEgc2hvcnQgbm90ZSAobm8gUFIpLlxuXG4yKSBGb3IgdGhlIGNsYWltZWQgc2x1ZzpcbiAgIC0gQnJhbmNoIGludGVncmF0ZS9jb21wYW55LzxzbHVnPiBmcm9tIGxhdGVzdCBkZXZcbiAgIC0gRm9sbG93IGRvY3MvYWdlbnQtY29tcGFueS1pbnRlZ3JhdGlvbi5tZFxuICAgLSBVc2UgcXVldWUgYm9hcmRUb2tlbi90aWVyOyBkbyBub3QgZ3Vlc3MgdG9rZW5zXG4gICAtIEFkZCBtaWdyYXRpb24sIHJlZ2lzdHJ5LCB0ZXN0cyBhcyBuZWVkZWRcbiAgIC0gUnVuOiBucG0gcnVuIHZlcmlmeTppbnRlZ3JhdGlvbiAtLSA8c2x1Zz5cbiAgIC0gSWYgU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWSBpcyBzZXQ6IG5wbSBydW4gdmVyaWZ5OmludGVncmF0aW9uIC0tIDxzbHVnPiAtLXNjcmFwZVxuICAgLSBPcGVuIE9ORSBQUiB0byBkZXYgd2l0aCB2ZXJpZnkgb3V0cHV0XG4gICAtIE9uIHN1Y2Nlc3M6IG5wbSBydW4gaW50ZWdyYXRpb246cXVldWUgLS0gY29tcGxldGUgPHNsdWc-IC0tcG9zdGluZ3MgPE4-XG4gICAtIE9uIGZhaWx1cmU6IG5wbSBydW4gaW50ZWdyYXRpb246cXVldWUgLS0gYmxvY2sgPHNsdWc-IC0tcmVhc29uIFwic2hvcnQgcmVhc29uXCJcblxuMykgSW5jbHVkZSBkb2NzL2NvbXBhbnktaW50ZWdyYXRpb24tcXVldWUuanNvbiBpbiB0aGUgUFIuXG5cblJ1bGVzOiBVUyBlbmdpbmVlcmluZyBpbnRlcm5zaGlwcyBvbmx5OyBxdWFsaXR5IG92ZXIgc3BlZWQuIiwiYWN0aW9ucyI6W3sidHlwZSI6Im9wZW5fcHVsbF9yZXF1ZXN0In1dfX0) — if prefill fails, use manual steps in §4.

## One-time setup

### 1. GitHub + Vercel

- Protect `main`; require PR + CI
- Vercel **production branch** = `main` (https://www.trypathway.app)
- Integration staging = **`dev`** → https://dev.trypathway.app (Preview; updates on every `dev` push)
- Feature branches get their own Preview URLs; merge into `dev`, not `main`

### 2. Initialize the queue (local, once)

```bash
npm run integration:queue -- init
npm run integration:queue -- sync
npm run integration:queue -- status
```

`init` adds the seed backlog. `sync` marks companies that already have `company_sources` migrations as `done`.

### 3. Curate the backlog

Edit `docs/company-integration-queue.json`:

- Set `autoApprove: true` on Greenhouse/Lever/Ashby rows once `boardToken` is confirmed
- Set `autoApprove: false` on hard custom ATS (Apple, Google, …) until you add `boardToken` / `notes`
- Add more slugs toward 500; keep `priority` lower = sooner

**Hourly agents only auto-claim `pending` + `autoApprove: true`.** Tier C rows need `--include-custom` or you flip `autoApprove` after research.

### 4. Create the automation

[cursor.com/automations](https://cursor.com/automations) → New automation:

| Field | Test run | After test passes |
|-------|----------|-------------------|
| **Trigger** | **Webhook** (run once on demand) | **Scheduled** `0 * * * *` (hourly) |
| **Repository** | `pathway`, branch **`dev`** | Same |
| **Tools** | None (direct apply) | Same |
| **Secrets** | [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents) — `SUPABASE_SERVICE_ROLE_KEY` | Same |
| **Claim size** | `--count 1` in prompt | `--count 2` or default `claimBatchSize` |

### 5. Automation prompt (paste into Cursor)

```markdown
You run the Pathway company integration batch. Do not push to main.

## 1. Run one integration (claim + apply)
From repo root on branch **dev**:
  INTEGRATION_COMMIT_DEV=1 npm run integration:queue -- run --count 1 --json

If count is 0, exit successfully with a short note.

## 2. What this does (no PR for standard ATS)
- Claims one `pending` + `autoApprove` company from docs/company-integration-queue.json
- For greenhouse/lever/ashby: runs npm run integration:apply (live verify + Supabase upsert)
- Marks queue row done or blocked
- Optionally commits queue + migration file to **dev** (not main)

## 3. Custom tiers only (apple, google, nvidia, etc.)
If tier is custom and apply fails with "requires manual integration":
- Do NOT open a PR unless you are adding adapter code in lib/scraping/
- Block with reason: npm run integration:queue -- block <slug> --reason "..."

## Rules
- Requires SUPABASE_SERVICE_ROLE_KEY in Cloud Agents secrets
- US-only engineering internships only
- Never push to main
- No pull requests for standard ATS integrations
- Target quality over speed: 0 applies is OK if nothing claimable
```

### 6. Optional second automation (Tier C research)

Schedule: `0 8 * * 1` (Monday 8am) or manual trigger  
Prompt: `npm run integration:queue -- claim --count 2 --custom-only --json` then same loop.

Use this for Apple/Google/Meta after you add hints to the queue.

## Operator commands

```bash
npm run integration:queue -- status
npm run integration:queue -- claim --count 3 --json
npm run integration:queue -- complete stripe --postings 14
npm run integration:queue -- block apple --reason "No public JSON API"
npm run integration:queue -- release-stale
```

## PR review at scale

Expect **up to ~50 small PRs/day**. Review in batches:

- Greenhouse PRs: verify CI + `verify:integration` output in description
- Merge quickly when checks are boringly green
- Blocked slugs stay out of the claim pool until you fix queue metadata

## Billing note

Hourly cloud agents bill per run. 24 runs/day × ~2 companies ≈ 48 agent sessions/day. Tune `claimBatchSize` and schedule if cost is high.
