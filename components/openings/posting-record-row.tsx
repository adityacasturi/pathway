"use client";

import type { MouseEvent } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { MotionStaggerItem } from "@/components/design-system/motion-stagger";
import { SeasonBadge } from "@/components/season-badge";
import { formatPostingRelativeTime } from "@/lib/feed/posted-display";
import { parseCompanySlugFromSourceId } from "@/lib/feed/company-slug";
import { formatCompactLocationSegments } from "@/lib/feed/us-locations";
import type { FeedPosting } from "@/lib/feed/source";
import { safeExternalHref } from "@/lib/url";
import { LINK_MUTED_CLASS } from "@/lib/ui/link-styles";
import { cn } from "@/lib/utils";

const DESKTOP_GRID =
  "grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.45fr)_minmax(0,0.92fr)_minmax(0,0.7fr)_minmax(0,0.71fr)] items-stretch";

const BODY_CELL =
  "flex min-h-full min-w-0 items-center border-r border-border/50 px-4 py-1.5 last:border-r-0";

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(BODY_CELL, className)}>{children}</div>;
}

function stopLinkPropagation(event: MouseEvent<HTMLAnchorElement>) {
  event.stopPropagation();
}

export function PostingRecordRow({
  posting,
  selected = false,
  onOpen,
  layout,
  index = 0,
}: {
  posting: FeedPosting;
  index?: number;
  selected?: boolean;
  onOpen?: () => void;
  layout: "desktop" | "mobile";
}) {
  const postingHref = safeExternalHref(posting.url);
  const locationLabel = formatCompactLocationSegments(posting.locations, 1) || "Unknown";
  const ageLabel = formatPostingRelativeTime(posting.postedDisplay) || "—";
  const companySlug = parseCompanySlugFromSourceId(posting.sourceId);

  const rowClassName = cn(
    "w-full min-h-[2.25rem] border-b border-border/60 text-left transition-colors hover:bg-muted/30",
    selected && "bg-muted/50",
  );

  if (layout === "mobile") {
    return (
      <MotionStaggerItem as="li" index={index}>
        <button
          type="button"
          data-testid="posting-row"
          data-posting-id={posting.id}
          onClick={onOpen}
          className={cn(
            "flex w-full items-center gap-3 py-3.5 pl-5 pr-4",
            rowClassName,
            "border-b-0",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <CompanyLogo
              company={posting.company}
              companySlug={companySlug}
              logoAssetKey={posting.companyLogoAssetKey}
              websiteUrl={posting.companyWebsiteUrl}
              size={32}
              lazy
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{posting.company}</p>
              {postingHref ? (
                <a
                  href={postingHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={stopLinkPropagation}
                  className={cn("block truncate text-xs text-foreground/80", LINK_MUTED_CLASS)}
                >
                  {posting.title}
                </a>
              ) : (
                <p className="truncate text-xs text-foreground/75">{posting.title}</p>
              )}
            </div>
            {posting.season ? <SeasonBadge season={posting.season} variant="plain" /> : null}
          </div>
        </button>
      </MotionStaggerItem>
    );
  }

  return (
    <MotionStaggerItem as="li" index={index}>
      <button
        type="button"
        data-testid="posting-row"
        data-posting-id={posting.id}
        onClick={onOpen}
        className={cn(DESKTOP_GRID, rowClassName)}
      >
        <TableCell>
          <span className="flex min-w-0 items-center gap-2.5">
            <CompanyLogo
              company={posting.company}
              companySlug={companySlug}
              logoAssetKey={posting.companyLogoAssetKey}
              websiteUrl={posting.companyWebsiteUrl}
              size={24}
              lazy
            />
            <span className="truncate text-sm font-medium text-foreground">{posting.company}</span>
          </span>
        </TableCell>
        <TableCell>
          {postingHref ? (
            <a
              href={postingHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopLinkPropagation}
              className={cn("min-w-0 truncate text-sm", LINK_MUTED_CLASS)}
            >
              {posting.title}
            </a>
          ) : (
            <span className="min-w-0 truncate text-sm text-foreground/90">{posting.title}</span>
          )}
        </TableCell>
        <TableCell>
          <span className="min-w-0 truncate text-sm text-foreground/80">{locationLabel}</span>
        </TableCell>
        <TableCell className="justify-center">
          {posting.season ? <SeasonBadge season={posting.season} variant="plain" /> : null}
        </TableCell>
        <TableCell>
          <span className="min-w-0 truncate text-sm tabular-nums text-foreground/80">
            {ageLabel}
          </span>
        </TableCell>
      </button>
    </MotionStaggerItem>
  );
}

export { DESKTOP_GRID as OPENINGS_DESKTOP_GRID };
