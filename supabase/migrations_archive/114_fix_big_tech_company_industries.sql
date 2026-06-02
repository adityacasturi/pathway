-- Reclassify companies that are not big-tech platforms.

update public.companies set industry = 'productivity', updated_at = now()
where slug in ('adobe', 'autodesk');

update public.companies set industry = 'devtools', updated_at = now()
where slug = 'jetbrains';

update public.companies set industry = 'cloud', updated_at = now()
where slug in ('cisco', 'micron');
