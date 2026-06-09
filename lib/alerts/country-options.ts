import { ALERT_COUNTRY_CODES } from "@/lib/config/alert-filters";
import { formatCountryCode, type CountryFilterOption } from "@/lib/feed/country-filter";

export const ALERT_COUNTRY_FILTER_OPTIONS: CountryFilterOption[] = ALERT_COUNTRY_CODES.map(
  (code) => ({
    code,
    label: formatCountryCode(code),
  }),
);
