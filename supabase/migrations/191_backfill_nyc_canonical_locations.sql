-- Backfill NYC postings stored as state-level "New York, United States".
update public.scraped_postings
set
  location = 'New York City, NY, United States',
  location_places = jsonb_build_array(
    jsonb_build_object(
      'city', 'New York City',
      'region', 'NY',
      'country_code', 'US',
      'remote', false
    )
  )
where location = 'New York, United States';
