-- Migration 032: prevent duplicate active applications for the same posting.
--
-- Archived rows are excluded so a user can keep history while still
-- re-adding a posting later if needed.

create unique index if not exists applications_unique_active_posting_url_idx
  on public.applications (user_id, lower(posting_url))
  where posting_url is not null
    and archived_at is null;
