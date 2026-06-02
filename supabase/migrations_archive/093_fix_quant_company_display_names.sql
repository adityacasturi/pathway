-- Correct display names for quant firms (logo.dev name lookup + UI).

update public.companies
set name = 'IMC Trading'
where slug = 'imc';

update public.companies
set name = 'DRW Holdings'
where slug = 'drw';
