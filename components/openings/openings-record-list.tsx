"use client";

import type { RefObject } from "react";
import { ArrowDown, ArrowUp, Briefcase, Building2, CalendarRange, Clock, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { OPENINGS_DESKTOP_GRID, PostingRecordRow } from "@/components/openings/posting-record-row";
import { MotionStaggerList } from "@/components/design-system/motion-stagger";
import { EmptyState } from "@/components/design-system/states";
import type { FeedPosting } from "@/lib/feed/source";
import { cn } from "@/lib/utils";
import type { OpeningsSortDirection, OpeningsSortKey } from "@/components/openings/openings-filter-bar";

const DESKTOP_GRID = OPENINGS_DESKTOP_GRID;

const HEADER_CELL =
  "flex min-h-full items-center border-r border-border/70 px-4 py-0 last:border-r-0";

function SortableHeaderCell({
  label,
  icon: Icon,
  columnKey,
  sortKey,
  sortDirection,
  onSortChange,
  align = "left",
}: {
  label: string;
  icon: LucideIcon;
  columnKey: OpeningsSortKey;
  sortKey: OpeningsSortKey | null;
  sortDirection: OpeningsSortDirection;
  onSortChange: (key: OpeningsSortKey) => void;
  align?: "left" | "center";
}) {
  const activeKey = sortKey ?? "posted";
  const activeDirection = sortKey ? sortDirection : "desc";
  const isActive = activeKey === columnKey;
  const SortIcon = activeDirection === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className={HEADER_CELL}>
      <button
        type="button"
        onClick={() => onSortChange(columnKey)}
        aria-pressed={isActive}
        aria-label={`${label}: ${
          isActive
            ? `sorted ${activeDirection === "asc" ? "ascending" : "descending"}`
            : "not sorted"
        }`}
        className={cn(
          "flex h-full w-full items-center gap-1.5 py-2 text-[13px] font-medium transition-colors",
          align === "center" ? "justify-center" : "justify-start",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground/70" aria-hidden />
        <span>{label}</span>
        {isActive ? (
          <SortIcon
            size={12}
            strokeWidth={2}
            className={cn("shrink-0 text-foreground/70", align === "center" ? "" : "ml-auto")}
            aria-hidden
          />
        ) : null}
      </button>
    </div>
  );
}

interface Props {
  postings: FeedPosting[];
  totalCount: number;
  hasActiveFilters: boolean;
  searchQuery: string;
  loadMoreRef?: RefObject<HTMLDivElement | null>;
  hasMoreRows?: boolean;
  sortKey: OpeningsSortKey | null;
  sortDirection: OpeningsSortDirection;
  onSortChange: (key: OpeningsSortKey) => void;
  isPostingNew: (posting: FeedPosting) => boolean;
  trackedIdSet: Set<string>;
  selectedId?: string | null;
  onOpen: (posting: FeedPosting) => void;
}

export function OpeningsRecordList({
  postings,
  totalCount,
  hasActiveFilters,
  searchQuery,
  loadMoreRef,
  hasMoreRows = false,
  sortKey,
  sortDirection,
  onSortChange,
  isPostingNew,
  trackedIdSet,
  selectedId = null,
  onOpen,
}: Props) {
  if (postings.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-card p-8">
        <EmptyState
          key={hasActiveFilters ? "filtered-empty" : "base-empty"}
          title={hasActiveFilters ? "No matches" : "No openings yet"}
          description={
            hasActiveFilters
              ? `Nothing matches "${searchQuery.trim()}". Clear filters or broaden your search.`
              : "New roles appear here after the feed refreshes."
          }
          className="max-w-md border-none bg-transparent py-8"
        />
      </div>
    );
  }

  return (
    <>
      <div className="hidden h-full min-h-0 flex-col bg-card md:flex">
        <div className={cn(DESKTOP_GRID, "shrink-0 border-b border-border bg-muted/25")}>
          <SortableHeaderCell
            label="Company"
            icon={Building2}
            columnKey="company"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <SortableHeaderCell
            label="Role"
            icon={Briefcase}
            columnKey="role"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <SortableHeaderCell
            label="Location"
            icon={MapPin}
            columnKey="location"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <SortableHeaderCell
            label="Season"
            icon={CalendarRange}
            columnKey="season"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
            align="center"
          />
          <SortableHeaderCell
            label="Posted"
            icon={Clock}
            columnKey="posted"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <MotionStaggerList as="ul">
            {postings.map((posting, index) => (
              <PostingRecordRow
                key={posting.id}
                index={index}
                posting={posting}
                isNew={isPostingNew(posting) && !trackedIdSet.has(posting.id)}
                selected={selectedId === posting.id}
                onOpen={() => onOpen(posting)}
                layout="desktop"
              />
            ))}
          </MotionStaggerList>
          {hasMoreRows ? <div ref={loadMoreRef} className="h-8" aria-hidden="true" /> : null}
        </div>

        <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-2">
          <p className="text-xs text-foreground/75">
            <span className="font-medium tabular-nums text-foreground">{totalCount}</span> count
          </p>
        </div>
      </div>

      <MotionStaggerList as="ul" className="divide-y divide-border bg-card md:hidden">
        {postings.map((posting, index) => (
          <PostingRecordRow
            key={posting.id}
            index={index}
            posting={posting}
            isNew={isPostingNew(posting) && !trackedIdSet.has(posting.id)}
            selected={selectedId === posting.id}
            onOpen={() => onOpen(posting)}
            layout="mobile"
          />
        ))}
      </MotionStaggerList>
    </>
  );
}
