import type { SupabaseClient } from "@supabase/supabase-js";

export type CountryAllowlistDecision =
  | { allowed: true }
  | { allowed: false; reason: "country_not_allowed" | "country_unknown" };

export class CountryAllowlist {
  private readonly enabledCodes: ReadonlySet<string>;

  constructor(enabledCodes: Iterable<string>) {
    this.enabledCodes = new Set([...enabledCodes].map((c) => c.toUpperCase()));
  }

  check(countries: readonly string[]): CountryAllowlistDecision {
    if (countries.length === 0) {
      return { allowed: false, reason: "country_unknown" };
    }
    for (const code of countries) {
      if (this.enabledCodes.has(code.toUpperCase())) {
        return { allowed: true };
      }
    }
    return { allowed: false, reason: "country_not_allowed" };
  }

  static async load(supabase: SupabaseClient): Promise<CountryAllowlist> {
    const { data, error } = await supabase
      .from("allowed_countries")
      .select("country_code")
      .eq("enabled", true);
    if (error) throw error;
    return new CountryAllowlist((data ?? []).map((r) => r.country_code));
  }
}
