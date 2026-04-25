-- Migration 005: remove application link field
-- Drops the legacy link column from applications.

alter table applications
drop column if exists link;
