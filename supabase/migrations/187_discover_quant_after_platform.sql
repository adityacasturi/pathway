-- Move Quant trading directly under Big tech on Discover / Companies.
update public.discover_industries
set sort_order = 15
where slug = 'quant';
