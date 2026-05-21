import { detectCountriesAcross } from "../feed/location.ts";

/**
 * Pathway only surfaces internships located in the United States.
 * A posting passes when every detected country is US and at least one US
 * signal exists. Ambiguous or non-US locations are excluded.
 */
export function isUsOnlyInternship(locations: readonly string[]): boolean {
  const countries = detectCountriesAcross(locations);
  return countries.length > 0 && countries.every((code) => code === "US");
}

export function isUsOnlyInternshipCountries(countries: readonly string[]): boolean {
  return countries.length > 0 && countries.every((code) => code === "US");
}
