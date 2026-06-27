-- Replace retired all-new-roles instant feed with nightly-briefing digest feed.

update public.alert_subscriptions
set
  target_id = 'nightly-briefing',
  cadence = 'digest'
where target_type = 'feed'
  and target_id = 'all-new-roles';
