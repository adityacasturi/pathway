"use client";

import { Bookmark, CalendarDays, Clock, Link2, MapPin, Plus, X } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { MetadataRow } from "@/components/inspector/metadata-row";
import { SeasonDot } from "@/components/season-filter-section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPostingRelativeTime } from "@/lib/feed/posted-display";
import { parseCompanySlugFromSourceId } from "@/lib/feed/company-slug";
import { formatCompactLocationSegments } from "@/lib/feed/us-locations";
import type { FeedPosting } from "@/lib/feed/source";
import { displayUrl, safeExternalHref } from "@/lib/url";
import { cn } from "@/lib/utils";

export function PostingInspector({
  posting,
  saved,
  tracked,
  trackPending,
  savePending,
  onTrack,
  onToggleSaved,
  onClose,
  className,
}: {
  posting: FeedPosting | null;
  saved: boolean;
  tracked: boolean;
  trackPending?: boolean;
  savePending?: boolean;
  onTrack: () => void;
  onToggleSaved: () => void;
  onClose: () => void;
  className?: string;
}) {
  const open = Boolean(posting);

  if (!posting || !open) return null;

  const postingHref = safeExternalHref(posting.url);
  const locationLabel = formatCompactLocationSegments(posting.locations, 6) || "Unknown";
  const ageLabel = formatPostingRelativeTime(posting.postedDisplay);

  const panel = (
    <div
      className={cn("relative flex flex-col overflow-hidden bg-card", className)}
      aria-label={`${posting.company} details`}
    >
      <header className="relative shrink-0 border-b border-border px-5 py-5 pr-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-4 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <X size={18} strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-3">
          <CompanyLogo
            company={posting.company}
            companySlug={parseCompanySlugFromSourceId(posting.sourceId)}
            logoAssetKey={posting.companyLogoAssetKey}
            websiteUrl={posting.companyWebsiteUrl}
            size={56}
            lazy
          />
          <div className="flex h-14 min-w-0 flex-1 flex-col justify-center gap-0">
            <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
              {posting.company}
            </h2>
            <p className="text-[15px] leading-snug text-muted-foreground">{posting.title}</p>
          </div>
        </div>
      </header>

      <section
        aria-label="Details"
        className="shrink-0 border-b border-border px-5 py-5"
      >
        <div className="space-y-2.5">
          {posting.season ? (
            <MetadataRow icon={CalendarDays}>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <SeasonDot season={posting.season} />
                {posting.season}
              </span>
            </MetadataRow>
          ) : null}
          {locationLabel ? (
            <MetadataRow icon={MapPin}>
              <span className="line-clamp-2 text-muted-foreground" title={locationLabel}>
                {locationLabel}
              </span>
            </MetadataRow>
          ) : null}
          {postingHref ? (
            <MetadataRow icon={Link2}>
              <a
                href={postingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-muted-foreground transition-colors hover:text-foreground hover:underline"
                title={posting.url}
              >
                {displayUrl(posting.url)}
              </a>
            </MetadataRow>
          ) : null}
          {ageLabel ? (
            <MetadataRow icon={Clock}>
              <span className="text-muted-foreground">Posted {ageLabel}</span>
            </MetadataRow>
          ) : null}
        </div>
      </section>

      <div className="flex items-center justify-center px-5 py-10">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/75">
          Coming soon: auto apply
        </p>
      </div>

      <footer className="shrink-0 border-t border-border px-5 py-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 flex-1 gap-1.5 text-xs"
            disabled={tracked || trackPending}
            onClick={onTrack}
          >
            <Plus size={14} strokeWidth={1.75} aria-hidden />
            {tracked ? "Tracked" : trackPending ? "Tracking…" : "Track"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 flex-1 gap-1.5 text-xs"
            disabled={savePending}
            onClick={onToggleSaved}
            aria-label={saved ? "Unsave posting" : "Save posting"}
          >
            <Bookmark
              size={14}
              strokeWidth={1.75}
              className={saved ? "fill-current text-[var(--selection-fg)]" : undefined}
              aria-hidden
            />
            {saved ? "Saved" : savePending ? "Saving…" : "Save"}
          </Button>
        </div>
      </footer>
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
          "flex max-h-[88dvh] w-full flex-col gap-0 overflow-hidden rounded-xl border-border bg-card p-0 shadow-[0_34px_110px_-64px_color-mix(in_oklab,var(--ink)_85%,transparent)] sm:max-w-[var(--app-inspector-width)]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {posting.company} — {posting.title}
          </DialogTitle>
        </DialogHeader>
        {panel}
      </DialogContent>
    </Dialog>
  );
}
