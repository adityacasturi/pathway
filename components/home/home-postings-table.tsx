"use client";

import { CompanyLogo } from "@/components/company-logo";
import { SeasonBadge } from "@/components/season-badge";
import { parseCompanySlugFromSourceId } from "@/lib/feed/company-slug";
import type { FeedPosting } from "@/lib/feed/source";
import { formatCompactLocationSegments } from "@/lib/feed/us-locations";
import { safeExternalHref } from "@/lib/url";
import { cn } from "@/lib/utils";
import { HOME_ROW_BORDER, HOME_ROW_HOVER } from "@/components/home/home-section-styles";

export const HOME_POSTING_ROW_CLASS = "h-[2.75rem] overflow-hidden";
export const HOME_POSTING_ROW_FLEX_CLASS = "h-full min-h-0 overflow-hidden";

/** Fixed row height — panels size from slot count × this value, not flex ratios. */
export const HOME_POSTING_ROW_HEIGHT = "2.75rem";

export function homePostingsTableBodyHeight(slotCount: number): string {
  return `calc(${slotCount} * ${HOME_POSTING_ROW_HEIGHT})`;
}

export const HOME_POSTINGS_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)_minmax(0,1fr)_minmax(0,0.65fr)]";

const HEADER_CELL =
  "flex min-h-full items-center border-r border-border/70 px-4 py-0 last:border-r-0";

const BODY_CELL =
  "flex min-h-full min-w-0 items-center border-r border-border/50 px-4 py-2.5 last:border-r-0";

export function HomeTableHeaderCell({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn(HEADER_CELL, className)}>
      <span className="py-2.5 text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function HomeTableBodyCell({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(BODY_CELL, className)}>{children}</div>;
}

function CompanyCell({ posting }: { posting: FeedPosting }) {
  return (
    <HomeTableBodyCell>
      <span className="flex min-w-0 items-center gap-2.5">
        <CompanyLogo
          company={posting.company}
          companySlug={parseCompanySlugFromSourceId(posting.sourceId)}
          logoAssetKey={posting.companyLogoAssetKey}
          websiteUrl={posting.companyWebsiteUrl}
          size={24}
          lazy
        />
        <span className="truncate text-sm font-medium text-foreground">{posting.company}</span>
      </span>
    </HomeTableBodyCell>
  );
}

function RoleCell({ posting }: { posting: FeedPosting }) {
  return (
    <HomeTableBodyCell>
      <span className="min-w-0 truncate text-sm text-foreground/90">{posting.title}</span>
    </HomeTableBodyCell>
  );
}

function LocationCell({ posting }: { posting: FeedPosting }) {
  const location = formatCompactLocationSegments(posting.locations, 1) || "Unknown";
  return (
    <HomeTableBodyCell>
      <span className="min-w-0 truncate text-sm text-foreground/80">{location}</span>
    </HomeTableBodyCell>
  );
}

function SeasonCell({ posting }: { posting: FeedPosting }) {
  return (
    <HomeTableBodyCell>
      {posting.season ? (
        <SeasonBadge season={posting.season} variant="plain" className="shrink-0" />
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
    </HomeTableBodyCell>
  );
}

export function HomePostingRow({ posting, flexHeight }: { posting: FeedPosting; flexHeight?: boolean }) {
  const href = safeExternalHref(posting.url);

  const row = (
    <>
      <CompanyCell posting={posting} />
      <RoleCell posting={posting} />
      <LocationCell posting={posting} />
      <SeasonCell posting={posting} />
    </>
  );

  const rowClass = cn(
    HOME_POSTINGS_GRID,
    flexHeight ? HOME_POSTING_ROW_FLEX_CLASS : HOME_POSTING_ROW_CLASS,
    "w-full text-left",
    HOME_ROW_HOVER,
  );

  if (href) {
    return (
      <li className={cn("overflow-hidden", HOME_ROW_BORDER)}>
        <a href={href} target="_blank" rel="noopener noreferrer" className={rowClass}>
          {row}
        </a>
      </li>
    );
  }

  return (
    <li className={cn(rowClass, "overflow-hidden", HOME_ROW_BORDER)}>{row}</li>
  );
}

export function HomeEmptyPostingRow({
  className,
  flexHeight,
}: {
  className?: string;
  flexHeight?: boolean;
}) {
  return (
    <li
      aria-hidden
      className={cn(
        HOME_POSTINGS_GRID,
        flexHeight ? HOME_POSTING_ROW_FLEX_CLASS : HOME_POSTING_ROW_CLASS,
        "overflow-hidden",
        HOME_ROW_BORDER,
        className,
      )}
    >
      <HomeTableBodyCell />
      <HomeTableBodyCell />
      <HomeTableBodyCell />
      <HomeTableBodyCell />
    </li>
  );
}

export const HOME_POSTINGS_TABLE_HEADERS = ["Company", "Role", "Location", "Season"] as const;
