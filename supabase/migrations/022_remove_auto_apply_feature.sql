-- Migration 022: remove the abandoned auto-apply feature.
--
-- This drops the profile/resume storage and hosted-browser run tracking that
-- were used only by auto apply. It preserves applications, events, feed
-- interactions, location, season, and archive data.
-- It also clears earlier abandoned feed-mirroring tables and the legacy
-- applications.link column if they still exist.

drop function if exists public.complete_auto_apply_run(uuid, date);

drop table if exists public.auto_apply_run_events cascade;
drop table if exists public.auto_apply_runs cascade;
drop table if exists public.applicant_profiles cascade;
drop table if exists public.internship_postings cascade;
drop table if exists public.internship_sources cascade;

alter table if exists public.applications
  drop column if exists link;

drop policy if exists "users can read own resume" on storage.objects;
drop policy if exists "users can insert own resume" on storage.objects;
drop policy if exists "users can update own resume" on storage.objects;
drop policy if exists "users can delete own resume" on storage.objects;
drop policy if exists "users can read own resumes" on storage.objects;
drop policy if exists "users can insert own resumes" on storage.objects;
drop policy if exists "users can update own resumes" on storage.objects;
drop policy if exists "users can delete own resumes" on storage.objects;

-- Do not delete from storage.objects or storage.buckets directly in SQL.
-- Supabase blocks direct deletes on storage tables; cleanup must go through
-- the Storage API or dashboard.
