-- Migration 002: add 'offer' as a valid status value
--
-- Postgres check constraints must be dropped and recreated to change allowed values.

alter table applications drop constraint applications_status_check;

alter table applications add constraint applications_status_check
  check (status in ('applied', 'oa', 'interview', 'offer', 'rejected'));
