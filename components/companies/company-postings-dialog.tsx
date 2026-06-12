"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bookmark,
  Briefcase,
  Building2,
  Clock,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { formatOpeningCount } from "@/components/companies/company-card";
import { MetadataRow } from "@/components/inspector/metadata-row";
import { MetadataStack } from "@/components/inspector/metadata-stack";
import { SeasonBadge } from "@/components/season-badge";
import { SearchInput } from "@/components/search-input";
import { DataToolbar, FilterPill } from "@/components/design-system/toolbar";
import { Button } from "@/components/ui/button";
import { FilterSection, SegmentedControl } from "@/components/ui/filter-menu";
import { InlineError } from "@/components/ui/inline-error";
import { LoadingState } from "@/components/design-system/states";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { scrapedPostingToFeedPosting } from "@/lib/discover/posting-feed";
import { getCompanyHealth } from "@/lib/discover/company-health";
import { hasAnyInteraction } from "@/lib/feed/interactions";
import { formatPostingRelativeTime } from "@/lib/feed/posted-display";
import { formatCompactLocationSegments } from "@/lib/feed/us-locations";
import type { FeedPosting } from "@/lib/feed/source";
import type { DiscoverCompanyCard, ScrapedPostingRow } from "@/lib/discover/types";
import { SEASON_FILTER_OPTIONS, type SeasonFilter } from "@/lib/config/season-filter";
import { safeExternalHref } from "@/lib/url";
import { UI_COUNT_BADGE } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

function CompanyInspectorMetadata({ company }: { company: DiscoverCompanyCard }) {
  const health = getCompanyHealth(company);
  const roleLabel = formatOpeningCount(company.openCount);

  return (
    <MetadataStack className="mt-2">
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
    </MetadataStack>
  );
}

function CompanyDialogPostingRow({
  posting,
  selected,
  onSelect,
}: {
  posting: ScrapedPostingRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const locationLabel = posting.location
    ? formatCompactLocationSegments([posting.location], 2)
    : "Unknown";
  const ageLabel = formatPostingRelativeTime(posting.postedDisplay);
  const metaLine = [locationLabel, ageLabel].filter(Boolean).join(" · ");
  const postingHref = safeExternalHref(posting.postingUrl);

  return (
    <li data-testid="posting-row" data-posting-id={posting.id}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full flex-col gap-1 px-6 py-3.5 text-left transition-colors hover:bg-muted/30",
          selected && "bg-[var(--selection-subtle-bg)]",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {postingHref ? (
            <a
              href={postingHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="min-w-0 truncate text-sm font-medium text-[var(--link)] transition-colors hover:text-[var(--link-hover)] hover:underline"
            >
              {posting.roleName}
            </a>
          ) : (
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {posting.roleName}
            </span>
          )}
          {posting.season ? (
            <SeasonBadge season={posting.season} variant="plain" className="shrink-0" />
          ) : null}
        </div>
        {metaLine ? (
          <p className="truncate text-xs text-muted-foreground">{metaLine}</p>
        ) : null}
      </button>
    </li>
  );
}

export function CompanyPostingsDialog({
  company,
  open,
  onOpenChange,
  postings,
  postingsRaw,
  postingsUntracked,
  loading,
  loadError,
  postingQuery,
  onPostingQueryChange,
  postingSeasonFilter,
  onPostingSeasonFilterChange,
  savedSet,
  pendingSavedIds,
  trackPendingId,
  onTrack,
  onToggleSaved,
}: {
  company: DiscoverCompanyCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postings: ScrapedPostingRow[] | null;
  postingsRaw: ScrapedPostingRow[] | null;
  postingsUntracked: ScrapedPostingRow[] | null;
  loading: boolean;
  loadError: string | null;
  postingQuery: string;
  onPostingQueryChange: (value: string) => void;
  postingSeasonFilter: SeasonFilter;
  onPostingSeasonFilterChange: (value: SeasonFilter) => void;
  savedSet: Set<string>;
  pendingSavedIds: Set<string>;
  trackPendingId: string | null;
  onTrack: (posting: FeedPosting) => void;
  onToggleSaved: (posting: FeedPosting, next: boolean) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const postingActiveFilterCount = postingSeasonFilter !== "all" ? 1 : 0;

  const activeSelectedPostingId =
    selectedPostingId && postings?.some((posting) => posting.id === selectedPostingId)
      ? selectedPostingId
      : null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFiltersOpen(false);
      setSelectedPostingId(null);
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    }
    if (!filtersOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [filtersOpen]);

  if (!company) return null;

  const selectedPosting =
    postings?.find((posting) => posting.id === activeSelectedPostingId) ?? null;
  const selectedFeedPosting = selectedPosting
    ? scrapedPostingToFeedPosting(
        selectedPosting,
        company.name,
        company.websiteUrl,
        company.logoAssetKey,
      )
    : null;
  const selectedSaved = selectedPosting
    ? hasAnyInteraction(savedSet, selectedPosting.interactionIds)
    : false;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,720px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="shrink-0 border-b border-border px-6 pb-5 pt-5">
          <DialogHeader className="pb-0">
            <DialogTitle className="sr-only">{company.name} openings</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-4">
            <CompanyLogo
              company={company.name}
              companySlug={company.slug}
              logoAssetKey={company.logoAssetKey}
              websiteUrl={company.websiteUrl}
              size={56}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
                {company.name}
              </h2>
              <CompanyInspectorMetadata company={company} />
            </div>
          </div>
        </div>

        {postingsUntracked && postingsUntracked.length > 0 ? (
          <div className="shrink-0 border-b border-border px-6 py-3">
            <DataToolbar
              leading={
                <SearchInput
                  value={postingQuery}
                  onChange={onPostingQueryChange}
                  placeholder="Search role or location…"
                />
              }
              trailing={
                <div ref={filtersRef} className="relative">
                  <FilterPill
                    active={postingActiveFilterCount > 0}
                    onClick={() => setFiltersOpen((value) => !value)}
                    aria-expanded={filtersOpen}
                  >
                    <SlidersHorizontal size={14} strokeWidth={1.75} />
                    Filters
                    {postingActiveFilterCount > 0 ? (
                      <span className={UI_COUNT_BADGE}>
                        {postingActiveFilterCount}
                      </span>
                    ) : null}
                  </FilterPill>
                  {filtersOpen ? (
                    <div className="absolute right-0 top-[calc(100%+6px)] z-[90] w-[min(100vw-3rem,20rem)] rounded-lg border border-border bg-popover p-3 shadow-sm sm:w-80">
                      <FilterSection title="Season">
                        <SegmentedControl
                          value={postingSeasonFilter}
                          options={SEASON_FILTER_OPTIONS}
                          onChange={onPostingSeasonFilterChange}
                        />
                      </FilterSection>
                    </div>
                  ) : null}
                </div>
              }
            />
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadError ? (
            <div className="px-6 py-6">
              <InlineError message={loadError} />
            </div>
          ) : loading && postings === null ? (
            <LoadingState label="Loading listings…" className="mx-6 my-4 border-0 bg-transparent" />
          ) : (postings?.length ?? 0) === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {postingsUntracked && postingsUntracked.length > 0
                ? "No roles match your search or filters."
                : postingsRaw && postingsRaw.length > 0
                  ? "All current openings are already in your pipeline."
                  : company.lastSuccessAt
                    ? "No openings right now."
                    : "Coming soon."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {postings?.map((posting) => (
                <CompanyDialogPostingRow
                  key={posting.id}
                  posting={posting}
                  selected={posting.id === activeSelectedPostingId}
                  onSelect={() =>
                    setSelectedPostingId((current) =>
                      current === posting.id ? null : posting.id,
                    )
                  }
                />
              ))}
            </ul>
          )}
        </div>

        {selectedFeedPosting ? (
          <div className="shrink-0 border-t border-border px-6 py-4">
            <section aria-label="Actions">
              <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Actions</h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 flex-1"
                  disabled={trackPendingId === selectedFeedPosting.id}
                  onClick={() => onTrack(selectedFeedPosting)}
                >
                  <Plus size={14} strokeWidth={2} />
                  {trackPendingId === selectedFeedPosting.id ? "Tracking…" : "Track"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-md px-3"
                  disabled={pendingSavedIds.has(selectedFeedPosting.id)}
                  onClick={() => onToggleSaved(selectedFeedPosting, !selectedSaved)}
                  aria-label={selectedSaved ? "Unsave posting" : "Save posting"}
                >
                  <Bookmark
                    size={14}
                    strokeWidth={1.75}
                    className={selectedSaved ? "fill-current text-[var(--selection-fg)]" : undefined}
                  />
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
