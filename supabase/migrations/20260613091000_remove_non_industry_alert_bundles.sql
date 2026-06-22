-- Keep alert bundles focused on industry groupings.

with removed_bundles(slug) as (
  select slug
  from public.alert_curated_sectors
  where group_label in ('Tech archetypes', 'Startup archetypes', 'Prestige')
)
delete from public.alert_subscriptions s
using removed_bundles b
where s.target_type = 'sector'
  and s.target_id = b.slug;

delete from public.alert_curated_sectors
where group_label in ('Tech archetypes', 'Startup archetypes', 'Prestige');
