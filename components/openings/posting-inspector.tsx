"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Clock, Link2, MapPin, Plus, X } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { MetadataRow } from "@/components/inspector/metadata-row";
import { MetadataStack } from "@/components/inspector/metadata-stack";
import { SeasonBadge } from "@/components/season-badge";
import { Button } from "@/components/ui/button";
import { formatPostingRelativeTime } from "@/lib/feed/posted-display";
import { parseCompanySlugFromSourceId } from "@/lib/feed/company-slug";
import { formatCompactLocationSegments } from "@/lib/feed/us-locations";
import type { FeedPosting } from "@/lib/feed/source";
import { displayUrl, safeExternalHref } from "@/lib/url";
import { useMounted } from "@/lib/ui/use-mounted";
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
  variant = "panel",
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
  variant?: "panel" | "overlay";
  className?: string;
}) {
  const mounted = useMounted();
  const open = Boolean(posting);

  useEffect(() => {
    if (!open || variant === "panel") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!posting || !open) return null;

  const postingHref = safeExternalHref(posting.url);
  const locationLabel = formatCompactLocationSegments(posting.locations, 6) || "Unknown";
  const ageLabel = formatPostingRelativeTime(posting.postedDisplay);

  const panel = (
    <aside
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden bg-card",
        className,
      )}
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

        <div className="flex items-start gap-4">
          <CompanyLogo
            company={posting.company}
            companySlug={parseCompanySlugFromSourceId(posting.sourceId)}
            logoAssetKey={posting.companyLogoAssetKey}
            websiteUrl={posting.companyWebsiteUrl}
            size={56}
            lazy
          />
          <div className="min-w-0 flex-1">
            <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
                {posting.company}
              </h2>
              {posting.season ? (
                <SeasonBadge season={posting.season} variant="plain" className="shrink-0 text-sm" />
              ) : null}
            </div>
            <p className="mt-0.5 text-[15px] leading-snug text-muted-foreground">{posting.title}</p>
            <PostingInspectorMetadata
              postingHref={postingHref}
              postingUrl={posting.url}
              locationLabel={locationLabel}
              ageLabel={ageLabel}
            />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <section aria-label="Actions">
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Actions</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 min-w-0 flex-[65] basis-0"
              disabled={tracked || trackPending}
              onClick={onTrack}
            >
              <Plus size={14} strokeWidth={2} />
              {tracked ? "Tracked" : trackPending ? "Tracking…" : "Track"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-w-0 flex-[35] basis-0 gap-1.5 rounded-md px-3"
              disabled={savePending}
              onClick={onToggleSaved}
              aria-label={saved ? "Unsave posting" : "Save posting"}
            >
              <Bookmark
                size={14}
                strokeWidth={1.75}
                className={saved ? "fill-current text-[var(--selection-fg)]" : undefined}
              />
              {saved ? "Saved" : savePending ? "Saving…" : "Save"}
            </Button>
          </div>
        </section>
      </div>
    </aside>
  );

  if (variant === "panel") {
    return panel;
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="ds-overlay-enter fixed inset-0 z-50 flex justify-end bg-[color-mix(in_oklab,var(--ink)_25%,transparent)] xl:hidden"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="ds-drawer-enter relative z-10 h-full w-full max-w-[var(--app-inspector-width)] shadow-[-16px_0_48px_-20px_color-mix(in_oklab,var(--ink)_22%,transparent)]">
        {panel}
      </div>
    </div>,
    document.body,
  );
}

function PostingInspectorMetadata({
  postingHref,
  postingUrl,
  locationLabel,
  ageLabel,
}: {
  postingHref: string | null;
  postingUrl: string;
  locationLabel: string;
  ageLabel: string;
}) {
  if (!postingHref && !locationLabel && !ageLabel) return null;

  return (
    <MetadataStack>
      {postingHref ? (
        <MetadataRow icon={Link2}>
          <a
            href={postingHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-muted-foreground transition-colors hover:text-foreground hover:underline"
            title={postingUrl}
          >
            {displayUrl(postingUrl)}
          </a>
        </MetadataRow>
      ) : null}
      {locationLabel ? (
        <MetadataRow icon={MapPin}>
          <span className="line-clamp-2 text-muted-foreground" title={locationLabel}>
            {locationLabel}
          </span>
        </MetadataRow>
      ) : null}
      {ageLabel ? (
        <MetadataRow icon={Clock}>
          <span className="text-muted-foreground">Posted {ageLabel}</span>
        </MetadataRow>
      ) : null}
    </MetadataStack>
  );
}
