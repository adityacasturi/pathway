"use client";

import { memo, useCallback, useMemo } from "react";
import { Bookmark, Check, Plus, RotateCcw, X } from "lucide-react";
import { formatPostingRelativeTime } from "@/lib/feed/posted-display";
import { CompanyLogo } from "@/components/company-logo";
import { MetaSeparator, PostingMetaLine } from "@/components/posting-meta-line";
import { formatCompactLocationSegments } from "@/lib/feed/us-locations";
import { safeExternalHref } from "@/lib/url";
import { cn } from "@/lib/utils";
import { parseCompanySlugFromSourceId } from "@/lib/feed/company-slug";
import type { FeedPosting } from "@/lib/feed/source";

type PostingRowDensity = "compact" | "comfortable";
type PostingRowVariant = "card" | "flat";

const ROW_DENSITY: Record<
  PostingRowDensity,
  {
    shell: string;
    logo: number;
    title: string;
    titleGap: string;
    location: string;
    age: string;
    iconButton: string;
    iconSize: number;
    trackedIconSize: number;
  }
> = {
  compact: {
    shell: "gap-3 px-3 py-2.5",
    logo: 30,
    title: "text-[14px]",
    titleGap: "mt-1",
    location: "text-[12px]",
    age: "text-[11px]",
    iconButton: "size-8",
    iconSize: 14,
    trackedIconSize: 13,
  },
  comfortable: {
    shell: "gap-4 px-4 py-3.5",
    logo: 36,
    title: "text-[15px]",
    titleGap: "mt-1.5",
    location: "text-[13px]",
    age: "text-[12px]",
    iconButton: "size-9",
    iconSize: 15,
    trackedIconSize: 14,
  },
};

interface RowProps {
  posting: FeedPosting;
  dismissed: boolean;
  saved: boolean;
  tracked: boolean;
  isNew: boolean;
  density?: PostingRowDensity;
  variant?: PostingRowVariant;
  pending?: boolean;
  savePending?: boolean;
  trackPending?: boolean;
  contextLabel?: string;
  onTrack: (posting: FeedPosting) => void | Promise<void>;
  onToggleSaved: (posting: FeedPosting, next: boolean) => void;
  onToggleDismiss?: (posting: FeedPosting, next: boolean) => void;
}

export const PostingRow = memo(function PostingRow({
  posting,
  dismissed,
  saved,
  tracked,
  isNew,
  density = "compact",
  variant = "card",
  pending,
  savePending,
  trackPending,
  contextLabel,
  onTrack,
  onToggleSaved,
  onToggleDismiss,
}: RowProps) {
  const rowStyle = ROW_DENSITY[density];
  const ageLabel = useMemo(
    () => formatPostingRelativeTime(posting.postedDisplay),
    [posting.postedDisplay],
  );
  const locationLabel = useMemo(
    () => formatCompactLocationSegments(posting.locations, 2),
    [posting.locations],
  );
  const postingHref = useMemo(() => safeExternalHref(posting.url), [posting.url]);
  const showAside = Boolean(locationLabel || ageLabel);

  const handleTrack = useCallback(() => onTrack(posting), [onTrack, posting]);
  const handleSave = useCallback(
    () => onToggleSaved(posting, !saved),
    [onToggleSaved, posting, saved],
  );
  const handleToggle = useCallback(() => {
    onToggleDismiss?.(posting, !dismissed);
  }, [onToggleDismiss, posting, dismissed]);

  return (
    <li
      data-testid="posting-row"
      data-posting-id={posting.id}
      className={dismissed ? "opacity-55 saturate-50" : undefined}
    >
      <div
        className={cn(
          "flex items-center transition-colors duration-150",
          variant === "card"
            ? cn("rounded-lg border border-border bg-card hover:bg-muted/30", rowStyle.shell)
            : cn("gap-2.5 px-1 py-2 hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)]"),
        )}
      >
        <CompanyLogo
          company={posting.company}
          companySlug={parseCompanySlugFromSourceId(posting.sourceId)}
          logoAssetKey={posting.companyLogoAssetKey}
          websiteUrl={posting.companyWebsiteUrl}
          size={rowStyle.logo}
          lazy
        />

        <div className="min-w-0 flex-1">
          <PostingMetaLine company={posting.company} season={posting.season}>
            {contextLabel ? (
              <>
                <MetaSeparator />
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {contextLabel}
                </span>
              </>
            ) : null}
            {isNew && !tracked ? (
              <>
                <MetaSeparator />
                <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-primary">
                  New
                </span>
              </>
            ) : null}
          </PostingMetaLine>
          <div className={cn("min-w-0", rowStyle.titleGap)}>
            {postingHref ? (
              <a
                href={postingHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "block truncate font-medium text-foreground decoration-muted-foreground/40 underline-offset-4 transition-colors duration-150 hover:text-primary hover:underline",
                  rowStyle.title,
                )}
              >
                {posting.title}
              </a>
            ) : (
              <p className={cn("truncate font-medium text-foreground", rowStyle.title)}>
                {posting.title}
              </p>
            )}
          </div>
          {showAside ? (
            <p className={cn("mt-1 truncate text-muted-foreground md:hidden", rowStyle.location)}>
              {[locationLabel, ageLabel].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        {showAside ? (
          <div className="hidden min-w-0 shrink-0 flex-col items-end gap-0.5 text-right md:flex md:max-w-[11rem]">
            {locationLabel ? (
              <span
                className={cn(
                  "w-full truncate font-normal text-foreground/72",
                  rowStyle.location,
                )}
              >
                {locationLabel}
              </span>
            ) : null}
            {ageLabel ? (
              <span
                className={cn(
                  "w-full truncate tabular-nums text-muted-foreground",
                  rowStyle.age,
                )}
              >
                {ageLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "flex shrink-0 items-center rounded-lg border border-border/80 bg-muted/35 p-0.5",
            density === "comfortable" ? "gap-0.5" : "gap-px",
          )}
          role="group"
          aria-label="Posting actions"
        >
          {tracked ? (
            <span
              aria-label="Tracked"
              title="Already in your pipeline"
              className={cn(
                "inline-flex items-center justify-center rounded-md text-primary",
                rowStyle.iconButton,
              )}
              style={{
                background: "color-mix(in oklab, var(--primary) 12%, transparent)",
              }}
            >
              <Check size={rowStyle.trackedIconSize} strokeWidth={2.5} />
            </span>
          ) : (
            <IconButton
              label="Track"
              onClick={handleTrack}
              disabled={trackPending}
              tone="positive"
              className={rowStyle.iconButton}
            >
              <Plus size={rowStyle.iconSize} strokeWidth={1.85} />
            </IconButton>
          )}
          <IconButton
            label={saved ? "Unsave" : "Save for later"}
            onClick={handleSave}
            disabled={savePending}
            tone={saved ? "saved" : "neutral"}
            className={rowStyle.iconButton}
          >
            <Bookmark
              size={rowStyle.iconSize}
              strokeWidth={1.85}
              fill={saved ? "currentColor" : "none"}
            />
          </IconButton>
          {onToggleDismiss ? (
            <IconButton
              label={dismissed ? "Restore" : "Dismiss"}
              onClick={handleToggle}
              disabled={pending}
              tone={dismissed ? "neutral" : "negative"}
              className={rowStyle.iconButton}
            >
              {dismissed ? (
                <RotateCcw size={rowStyle.iconSize} strokeWidth={1.85} />
              ) : (
                <X size={rowStyle.iconSize} strokeWidth={1.85} />
              )}
            </IconButton>
          ) : null}
        </div>
      </div>
    </li>
  );
});

type IconButtonTone = "positive" | "negative" | "neutral" | "saved";

const TONE_CLASSES: Record<IconButtonTone, string> = {
  positive:
    "text-foreground/55 hover:text-[color:var(--primary)] hover:bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]",
  negative:
    "text-foreground/55 hover:text-destructive hover:bg-destructive/10",
  neutral:
    "text-foreground/55 hover:text-foreground hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]",
  saved:
    "text-[color:var(--primary)] bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] hover:bg-[color-mix(in_oklab,var(--primary)_16%,transparent)]",
};

function IconButton({
  children,
  label,
  onClick,
  disabled,
  tone,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: IconButtonTone;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "group/posting-action relative inline-flex items-center justify-center rounded-md leading-none smooth-surface disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:block [&>svg]:shrink-0",
        className ?? "size-8",
        TONE_CLASSES[tone],
      )}
    >
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+7px)] left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-foreground shadow-[0_12px_28px_-18px_color-mix(in_oklab,var(--ink)_60%,transparent)] group-hover/posting-action:block group-focus-visible/posting-action:block">
        {label}
      </span>
    </button>
  );
}
