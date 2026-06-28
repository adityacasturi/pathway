"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Briefcase, Building2, Clock, ListFilter, X } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { formatOpeningCount } from "@/components/companies/company-card";
import { CountryFlag } from "@/components/country-flag";
import { CountryFilterSection } from "@/components/country-filter-section";
import { MetadataRow } from "@/components/inspector/metadata-row";
import { SeasonBadge } from "@/components/season-badge";
import { SeasonDot, SeasonFilterSection } from "@/components/season-filter-section";
import { SearchInput } from "@/components/search-input";
import { MotionStaggerItem, MotionStaggerList } from "@/components/design-system/motion-stagger";
import { SectionStack } from "@/components/design-system/surface";
import { FilterPill } from "@/components/design-system/toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCountryCode } from "@/lib/feed/country-filter";
import type { CountryFilterOption } from "@/lib/feed/country-filter";
import type { FeedSeason } from "@/lib/feed/types";
import { InlineError } from "@/components/ui/inline-error";
import { LoadingState } from "@/components/design-system/states";
import { getCompanyHealth } from "@/lib/discover/company-health";
import { formatPostingRelativeTime } from "@/lib/feed/posted-display";
import { formatCompactLocationSegments } from "@/lib/feed/us-locations";
import type { DiscoverCompanyCard, ScrapedPostingRow } from "@/lib/discover/types";
import { safeExternalHref } from "@/lib/url";
import { UI_TOOLBAR_FILTER_COUNT } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

function CompanyInspectorDetails({ company }: { company: DiscoverCompanyCard }) {
  const health = getCompanyHealth(company);
  const roleLabel = formatOpeningCount(company.openCount);

  return (
    <section aria-label="Details" className="shrink-0 border-b border-border px-5 py-5">
      <div className="space-y-2.5">
        <MetadataRow icon={Briefcase}>
          <span className="text-muted-foreground">{roleLabel}</span>
        </MetadataRow>
        <MetadataRow icon={Building2}>
          <span className="text-muted-foreground">{company.industryLabel}</span>
        </MetadataRow>
        {health.kind === "ok" ? (
          <MetadataRow icon={Clock}>
            <span className="text-muted-foreground">Updated {health.label}</span>
          </MetadataRow>
        ) : null}
        {health.kind === "pending" ? (
          <MetadataRow icon={Clock}>
            <span className="text-muted-foreground">{health.label}</span>
          </MetadataRow>
        ) : null}
        {health.kind === "failed" ? (
          <MetadataRow icon={AlertCircle}>
            <span className="text-muted-foreground">{health.label}</span>
          </MetadataRow>
        ) : null}
      </div>
    </section>
  );
}

function CompanyInspectorPostingRow({
  posting,
  onOpen,
  index,
}: {
  posting: ScrapedPostingRow;
  onOpen: () => void;
  index: number;
}) {
  const locationLabel = posting.location
    ? formatCompactLocationSegments([posting.location], 2)
    : "Unknown";
  const ageLabel = formatPostingRelativeTime(posting.postedDisplay);
  const postingHref = safeExternalHref(posting.postingUrl);

  return (
    <MotionStaggerItem as="li" index={index}>
      <button
        type="button"
        data-testid="posting-row"
        data-posting-id={posting.feedId}
        onClick={onOpen}
        className="flex w-full min-w-0 cursor-pointer items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30 sm:items-center sm:py-2.5"
      >
        <div className="min-w-0 flex-1 space-y-1 sm:space-y-0">
          <div className="min-w-0 sm:flex sm:items-center sm:gap-2">
            {postingHref ? (
              <a
                href={postingHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="line-clamp-2 text-sm font-medium leading-snug text-[var(--link)] transition-colors hover:text-[var(--link-hover)] hover:underline sm:line-clamp-none sm:truncate"
              >
                {posting.roleName}
              </a>
            ) : (
              <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground sm:line-clamp-none sm:truncate">
                {posting.roleName}
              </span>
            )}
            {posting.season ? (
              <SeasonBadge
                season={posting.season}
                variant="plain"
                className="mt-1 shrink-0 sm:mt-0"
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground sm:mt-1">
            {locationLabel ? <span className="min-w-0 truncate">{locationLabel}</span> : null}
            {locationLabel && ageLabel ? (
              <span aria-hidden className="shrink-0 text-foreground/60 sm:hidden">
                ·
              </span>
            ) : null}
            {ageLabel ? (
              <span className="shrink-0 tabular-nums sm:hidden">{ageLabel}</span>
            ) : null}
          </div>
        </div>
        {ageLabel ? (
          <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
            {ageLabel}
          </span>
        ) : null}
      </button>
    </MotionStaggerItem>
  );
}

function CompanyInspectorFilterPanel({
  selectedPostingSeasons,
  onTogglePostingSeason,
  onClearPostingSeasons,
  postingSeasonCounts,
  countryFilterOptions,
  selectedPostingCountries,
  onTogglePostingCountry,
  onClearPostingCountries,
  className,
}: {
  selectedPostingSeasons: ReadonlySet<FeedSeason>;
  onTogglePostingSeason: (season: FeedSeason) => void;
  onClearPostingSeasons: () => void;
  postingSeasonCounts?: Partial<Record<FeedSeason, number>>;
  countryFilterOptions: CountryFilterOption[];
  selectedPostingCountries: ReadonlySet<string>;
  onTogglePostingCountry: (code: string) => void;
  onClearPostingCountries: () => void;
  className?: string;
}) {
  return (
    <SectionStack className={className}>
      <SeasonFilterSection
        compact
        selected={selectedPostingSeasons}
        onToggle={onTogglePostingSeason}
        onClear={onClearPostingSeasons}
        counts={postingSeasonCounts}
        chipClassName="h-7 px-2.5 text-[12px]"
      />
      <CountryFilterSection
        compact
        showFlags
        options={countryFilterOptions}
        selected={selectedPostingCountries}
        onToggle={onTogglePostingCountry}
        onClear={onClearPostingCountries}
        chipClassName="h-7 px-2.5 text-[12px]"
      />
    </SectionStack>
  );
}

export function CompanyInspector({
  company,
  postings,
  postingsRaw,
  postingsAvailable,
  loading,
  loadError,
  postingQuery,
  onPostingQueryChange,
  selectedPostingSeasons,
  onTogglePostingSeason,
  onClearPostingSeasons,
  postingSeasonCounts,
  countryFilterOptions,
  selectedPostingCountries,
  onTogglePostingCountry,
  onClearPostingCountries,
  onOpenPosting,
  onClose,
  className,
}: {
  company: DiscoverCompanyCard | null;
  postings: ScrapedPostingRow[] | null;
  postingsRaw: ScrapedPostingRow[] | null;
  postingsAvailable: ScrapedPostingRow[] | null;
  loading: boolean;
  loadError: string | null;
  postingQuery: string;
  onPostingQueryChange: (value: string) => void;
  selectedPostingSeasons: ReadonlySet<FeedSeason>;
  onTogglePostingSeason: (season: FeedSeason) => void;
  onClearPostingSeasons: () => void;
  postingSeasonCounts?: Partial<Record<FeedSeason, number>>;
  countryFilterOptions: CountryFilterOption[];
  selectedPostingCountries: ReadonlySet<string>;
  onTogglePostingCountry: (code: string) => void;
  onClearPostingCountries: () => void;
  onOpenPosting: (posting: ScrapedPostingRow) => void;
  onClose: () => void;
  className?: string;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileFilterPanelRef = useRef<HTMLDivElement | null>(null);
  const postingActiveFilterCount =
    selectedPostingSeasons.size + selectedPostingCountries.size;
  const hasActivePostingChips =
    postingActiveFilterCount > 0 || postingQuery.trim().length > 0;
  const open = Boolean(company);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        if (
          !filterPanelRef.current?.contains(event.target as Node) &&
          !mobileFilterPanelRef.current?.contains(event.target as Node)
        ) {
          setFiltersOpen(false);
        }
      }
    }
    if (!filtersOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [filtersOpen]);

  if (!company || !open) return null;

  const panel = (
    <div
      className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden bg-card", className)}
      aria-label={`${company.name} openings`}
    >
      <header className="relative shrink-0 border-b border-border px-5 py-5 pr-12">
        <button
          type="button"
          onClick={() => {
            setFiltersOpen(false);
            onClose();
          }}
          aria-label="Close"
          className="absolute right-3 top-4 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <X size={18} strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-3">
          <CompanyLogo
            company={company.name}
            companySlug={company.slug}
            logoAssetKey={company.logoAssetKey}
            websiteUrl={company.websiteUrl}
            size={56}
            lazy
          />
          <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-0">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
              {company.name}
            </h2>
          </div>
        </div>
      </header>

      <CompanyInspectorDetails company={company} />

      {postingsAvailable && postingsAvailable.length > 0 ? (
        <div className="shrink-0 border-b border-border">
          <div className="px-5 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 [&_input]:h-8 [&_input]:text-sm">
                <SearchInput
                  value={postingQuery}
                  onChange={onPostingQueryChange}
                  placeholder="Search role or location…"
                />
              </div>
              <div ref={filtersRef} className="relative w-full shrink-0 sm:w-auto">
                <FilterPill
                  active={filtersOpen || postingActiveFilterCount > 0}
                  onClick={() => setFiltersOpen((value) => !value)}
                  aria-expanded={filtersOpen}
                  className="w-full justify-center rounded-md sm:w-auto"
                >
                  <ListFilter size={14} strokeWidth={1.75} />
                  Filter
                  {postingActiveFilterCount > 0 ? (
                    <span className={UI_TOOLBAR_FILTER_COUNT}>{postingActiveFilterCount}</span>
                  ) : null}
                </FilterPill>
                {filtersOpen ? (
                  <div
                    ref={filterPanelRef}
                    className="absolute right-0 top-full z-[90] mt-1.5 hidden w-[min(22rem,calc(100vw-2rem))] sm:block"
                  >
                    <CompanyInspectorFilterPanel
                      selectedPostingSeasons={selectedPostingSeasons}
                      onTogglePostingSeason={onTogglePostingSeason}
                      onClearPostingSeasons={onClearPostingSeasons}
                      postingSeasonCounts={postingSeasonCounts}
                      countryFilterOptions={countryFilterOptions}
                      selectedPostingCountries={selectedPostingCountries}
                      onTogglePostingCountry={onTogglePostingCountry}
                      onClearPostingCountries={onClearPostingCountries}
                      className="shadow-sm"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {filtersOpen ? (
              <div ref={mobileFilterPanelRef} className="mt-2 sm:hidden">
                <CompanyInspectorFilterPanel
                  selectedPostingSeasons={selectedPostingSeasons}
                  onTogglePostingSeason={onTogglePostingSeason}
                  onClearPostingSeasons={onClearPostingSeasons}
                  postingSeasonCounts={postingSeasonCounts}
                  countryFilterOptions={countryFilterOptions}
                  selectedPostingCountries={selectedPostingCountries}
                  onTogglePostingCountry={onTogglePostingCountry}
                  onClearPostingCountries={onClearPostingCountries}
                  className="shadow-sm"
                />
              </div>
            ) : null}
          </div>
          {hasActivePostingChips ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-5 py-2">
              {postingQuery.trim() ? (
                <FilterPill active onClick={() => onPostingQueryChange("")}>
                  Search: {postingQuery.trim()}
                  <span aria-hidden>×</span>
                </FilterPill>
              ) : null}
              {[...selectedPostingSeasons].map((season) => (
                <FilterPill key={season} active onClick={() => onTogglePostingSeason(season)}>
                  <SeasonDot season={season} />
                  {season}
                  <span aria-hidden>×</span>
                </FilterPill>
              ))}
              {[...selectedPostingCountries].map((code) => (
                <FilterPill key={code} active onClick={() => onTogglePostingCountry(code)}>
                  <CountryFlag code={code} size="sm" />
                  {formatCountryCode(code)}
                  <span aria-hidden>×</span>
                </FilterPill>
              ))}
              <button
                type="button"
                onClick={() => {
                  onPostingQueryChange("");
                  onClearPostingSeasons();
                  onClearPostingCountries();
                }}
                className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadError ? (
          <div className="px-5 py-6">
            <InlineError message={loadError} />
          </div>
        ) : loading && postings === null ? (
          <LoadingState label="Loading listings…" className="mx-5 my-4 border-0 bg-transparent" />
        ) : (postings?.length ?? 0) === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {postingsAvailable && postingsAvailable.length > 0
              ? "No roles match your search or filters."
              : postingsRaw && postingsRaw.length > 0
                ? "All current openings are already in your pipeline."
                : company.lastSuccessAt
                  ? "No openings right now."
                  : "Coming soon."}
          </p>
        ) : (
          <MotionStaggerList
            key={`${company.id}:${postings?.map((row) => row.id).join(",") ?? ""}`}
            as="ul"
            className="divide-y divide-border"
          >
            {postings?.map((posting, index) => (
              <CompanyInspectorPostingRow
                key={posting.id}
                index={index}
                posting={posting}
                onOpen={() => onOpenPosting(posting)}
              />
            ))}
          </MotionStaggerList>
        )}
      </div>

    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex h-[min(42rem,88dvh)] max-h-[88dvh] w-full flex-col gap-0 overflow-hidden rounded-xl border-border bg-card p-0 shadow-[0_34px_110px_-64px_color-mix(in_oklab,var(--ink)_85%,transparent)] sm:max-w-[var(--app-company-inspector-width)]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{company.name}</DialogTitle>
        </DialogHeader>
        {panel}
      </DialogContent>
    </Dialog>
  );
}
