-- ASML careers use a public job-posting sitemap and Next.js job detail pages.
ALTER TABLE public.company_sources DROP CONSTRAINT IF EXISTS company_sources_source_type_check;

ALTER TABLE public.company_sources
  ADD CONSTRAINT company_sources_source_type_check
  CHECK (
    source_type = ANY (
      ARRAY[
        'greenhouse'::text, 'ashby'::text, 'lever'::text, 'workday'::text, 'nvidia'::text,
        'microsoft'::text, 'google'::text, 'jane_street'::text, 'hudson_river_trading'::text,
        'apple'::text, 'citadel'::text, 'two_sigma'::text, 'amazon'::text, 'meta'::text,
        'qualcomm'::text, 'uber'::text, 'salesforce'::text, 'de_shaw'::text, 'tesla'::text,
        'amd'::text, 'bytedance'::text, 'atlassian'::text, 'tower_research'::text, 'sig'::text,
        'rivian'::text, 'five_rings'::text, 'jpmorgan_chase'::text, 'bloomberg'::text,
        'goldman_sachs'::text, 'oracle'::text, 'morgan_stanley'::text, 'linkedin'::text,
        'intuit'::text, 'shopify'::text, 'netflix'::text, 'ibm'::text, 'coinbase'::text,
        'citigroup'::text, 'rtx'::text, 'millennium'::text, 'lockheed_martin'::text,
        'workable'::text, 'hiringthing'::text, 'surge'::text, 'smartrecruiters'::text,
        'github'::text, 'splunk'::text, 'slack'::text, 'jobvite'::text, 'juniper_networks'::text,
        'vmware'::text, 'sap'::text, 'teradata'::text, 'seagate'::text, 'l3harris'::text,
        'arm'::text, 'valve'::text, 'bae_systems'::text, 'chewy'::text, 'electronic_arts'::text,
        'etsy'::text, 'peak6'::text, 'wayfair'::text, 'general_dynamics'::text, 'sakana_ai'::text,
        'replicate'::text, 'luma_ai'::text, 'modular'::text, 'breezy'::text, 'weights_biases'::text,
        'one_x_technologies'::text, 'synopsys'::text, 'x_corp'::text, 'pinpoint'::text,
        'rippling'::text, 'clearcompany'::text, 'icims'::text, 'asml'::text
      ]
    )
  );
