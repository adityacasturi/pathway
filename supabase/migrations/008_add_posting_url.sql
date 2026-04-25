-- Migration 008: add posting URL to applications
--
-- Stores the original posting / job description URL so the user can revisit
-- it from the dashboard or detail view. Optional and freeform — no validation
-- happens at the DB layer.

alter table applications
add column if not exists posting_url text;
