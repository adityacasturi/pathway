"use client";

import { useMemo } from "react";
import { CountryFlag } from "@/components/country-flag";
import { CountryFilterSection } from "@/components/country-filter-section";
import { FilterPill } from "@/components/design-system/toolbar";
import { SeasonDot, SeasonFilterSection } from "@/components/season-filter-section";
import { ALERT_COUNTRY_FILTER_OPTIONS } from "@/lib/alerts/country-options";
import type { AlertFiltersView } from "@/lib/alerts/filters";
import type { AlertSeason } from "@/lib/config/alert-filters";
import { formatCountryCode } from "@/lib/feed/country-filter";
import type { FeedSeason } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

const CHIP_CLASS = "h-7 px-2.5 text-[12px]";

export function AlertFiltersEditor({
  value,
  onChange,
  disabled = false,
  fields = "all",
  clearLabel = "Clear",
  alwaysShowClear = false,
  onClearAction,
  hideSectionTitles = false,
  sectionUnstyled = false,
  hideSectionAction = false,
}: {
  value: AlertFiltersView;
  onChange: (next: AlertFiltersView) => void;
  disabled?: boolean;
  fields?: "all" | "seasons" | "countries";
  clearLabel?: string;
  alwaysShowClear?: boolean;
  onClearAction?: () => void;
  hideSectionTitles?: boolean;
  sectionUnstyled?: boolean;
  hideSectionAction?: boolean;
}) {
  const selectedSeasons = useMemo(
    () => new Set<FeedSeason>(value.seasons),
    [value.seasons],
  );
  const selectedCountries = useMemo(() => new Set(value.countries), [value.countries]);

  const toggleSeason = (season: FeedSeason) => {
    const next = new Set(value.seasons);
    const alertSeason = season as AlertSeason;
    if (next.has(alertSeason)) {
      next.delete(alertSeason);
    } else {
      next.add(alertSeason);
    }
    onChange({ ...value, seasons: [...next] });
  };

  const toggleCountry = (code: string) => {
    const next = new Set(value.countries);
    const countryCode = code as (typeof value.countries)[number];
    if (next.has(countryCode)) {
      next.delete(countryCode);
    } else {
      next.add(countryCode);
    }
    onChange({ ...value, countries: [...next] });
  };

  return (
    <div className={cn(disabled && "pointer-events-none opacity-60")}>
      {fields === "all" || fields === "seasons" ? (
        <SeasonFilterSection
          compact
          selected={selectedSeasons}
          onToggle={toggleSeason}
          onClear={
            onClearAction ?? (() => onChange({ ...value, seasons: [] }))
          }
          clearLabel={clearLabel}
          alwaysShowClear={alwaysShowClear}
          chipClassName={CHIP_CLASS}
          hideTitle={hideSectionTitles}
          unstyled={sectionUnstyled}
          hideAction={hideSectionAction}
        />
      ) : null}
      {fields === "all" || fields === "countries" ? (
        <CountryFilterSection
          compact
          showFlags
          options={ALERT_COUNTRY_FILTER_OPTIONS}
          selected={selectedCountries}
          onToggle={toggleCountry}
          onClear={
            onClearAction ?? (() => onChange({ ...value, countries: [] }))
          }
          clearLabel={clearLabel}
          alwaysShowClear={alwaysShowClear}
          chipClassName={CHIP_CLASS}
          hideTitle={hideSectionTitles}
          unstyled={sectionUnstyled}
          hideAction={hideSectionAction}
        />
      ) : null}
    </div>
  );
}

export function AlertDefaultsActiveRail({
  value,
  onChange,
  field,
  readOnly = false,
  label = "Selected defaults",
}: {
  value: AlertFiltersView;
  onChange?: (next: AlertFiltersView) => void;
  field?: "seasons" | "countries";
  readOnly?: boolean;
  label?: string;
}) {
  const seasons = field === "countries" ? [] : value.seasons;
  const countries = field === "seasons" ? [] : value.countries;
  const hasSeasons = seasons.length > 0;
  const hasCountries = countries.length > 0;

  if (!hasSeasons && !hasCountries) {
    if (field === "seasons") {
      return (
        <p className="text-sm text-muted-foreground">All seasons</p>
      );
    }
    if (field === "countries") {
      return (
        <p className="text-sm text-muted-foreground">All locations</p>
      );
    }
    return null;
  }

  return (
    <div className={cn(!readOnly && "border-b border-border bg-muted/30 px-4 pb-4 pt-4")}>
      {!readOnly ? (
        <p className="mb-3 text-xs font-medium text-muted-foreground">{label}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {seasons.map((season) => (
          <FilterPill
            key={season}
            active
            className="h-8 px-3 text-sm"
            onClick={
              readOnly || !onChange
                ? undefined
                : () =>
                    onChange({
                      ...value,
                      seasons: value.seasons.filter((entry) => entry !== season),
                    })
            }
          >
            <SeasonDot season={season} />
            {season}
            {readOnly ? null : <span aria-hidden>×</span>}
          </FilterPill>
        ))}
        {countries.map((code) => (
          <FilterPill
            key={code}
            active
            className="h-8 px-3 text-sm"
            onClick={
              readOnly || !onChange
                ? undefined
                : () =>
                    onChange({
                      ...value,
                      countries: value.countries.filter((entry) => entry !== code),
                    })
            }
          >
            <CountryFlag code={code} size="sm" />
            {ALERT_COUNTRY_FILTER_OPTIONS.find((option) => option.code === code)?.label ??
              formatCountryCode(code)}
            {readOnly ? null : <span aria-hidden>×</span>}
          </FilterPill>
        ))}
      </div>
    </div>
  );
}

export function hasActiveAlertFiltersView(value: AlertFiltersView): boolean {
  return countActiveAlertFiltersView(value) > 0;
}

export function countActiveAlertFiltersView(value: AlertFiltersView): number {
  let count = 0;
  if (value.seasons.length > 0) count += 1;
  if (value.countries.length > 0) count += 1;
  return count;
}
