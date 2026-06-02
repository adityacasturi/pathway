-- Email alert preferences, subscriptions, dedup ledger, and digest state.

create table public.alert_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  emails_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.alert_preferences enable row level security;

create policy "Users manage own alert preferences"
  on public.alert_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('company', 'industry')),
  target_id text not null,
  cadence text not null check (cadence in ('instant', 'digest')),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index alert_subscriptions_user_id_idx on public.alert_subscriptions (user_id);
create index alert_subscriptions_target_idx on public.alert_subscriptions (target_type, target_id);

alter table public.alert_subscriptions enable row level security;

create policy "Users manage own alert subscriptions"
  on public.alert_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.alert_sent_postings (
  user_id uuid not null references auth.users (id) on delete cascade,
  posting_id uuid not null references public.scraped_postings (id) on delete cascade,
  channel text not null check (channel in ('instant', 'digest')),
  sent_at timestamptz not null default now(),
  primary key (user_id, posting_id, channel)
);

create index alert_sent_postings_posting_id_idx on public.alert_sent_postings (posting_id);

alter table public.alert_sent_postings enable row level security;

create policy "Users read own sent postings"
  on public.alert_sent_postings for select
  using (auth.uid() = user_id);

create table public.alert_digest_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_sent_at timestamptz not null default now()
);

alter table public.alert_digest_state enable row level security;

create policy "Users read own digest state"
  on public.alert_digest_state for select
  using (auth.uid() = user_id);
