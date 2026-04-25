-- Migration 009: per-user interactions with the discover feed
--
-- The feed itself is not stored in Postgres. Postings are fetched on-demand
-- from the upstream listings.json and cached via Next.js ISR. This table
-- only records what each user has saved or dismissed, keyed by the upstream
-- posting id so we stay in sync even as the source list changes.

create table feed_interactions (
  user_id    uuid        references auth.users(id) on delete cascade not null,
  posting_id text        not null,
  kind       text        check (kind in ('saved', 'dismissed')) not null,
  created_at timestamptz default now() not null,
  primary key (user_id, posting_id, kind)
);

create index feed_interactions_user_idx on feed_interactions(user_id);

alter table feed_interactions enable row level security;

create policy "users can read own feed interactions"
  on feed_interactions for select
  using (auth.uid() = user_id);

create policy "users can insert own feed interactions"
  on feed_interactions for insert
  with check (auth.uid() = user_id);

create policy "users can delete own feed interactions"
  on feed_interactions for delete
  using (auth.uid() = user_id);
