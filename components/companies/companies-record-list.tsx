"use client";

import type { RefObject } from "react";
import { ArrowDown, ArrowUp, Briefcase, Building2, Clock, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MotionStaggerList } from "@/components/design-system/motion-stagger";
import { EmptyState } from "@/components/design-system/states";
import {
  CompanyRow,
  COMPANY_ROW_DESKTOP_GRID,
  COMPANY_ROW_HEADER_CELL,
} from "@/components/companies/company-row";
import type { DiscoverCompanyCard } from "@/lib/discover/types";
import type { CompanySortDirection, CompanySortKey } from "@/components/companies/companies-filter-bar";
import { cn } from "@/lib/utils";

function SortableHeaderCell({
  label,
  icon: Icon,
  columnKey,
  sortKey,
  sortDirection,
  onSortChange,
}: {
  label: string;
  icon: LucideIcon;
  columnKey: CompanySortKey;
  sortKey: CompanySortKey | null;
  sortDirection: CompanySortDirection;
  onSortChange: (key: CompanySortKey) => void;
}) {
  const activeKey = sortKey ?? "openings";
  const activeDirection = sortKey ? sortDirection : "desc";
  const isActive = activeKey === columnKey;

  return (
    <div className={COMPANY_ROW_HEADER_CELL}>
      <button
        type="button"
        onClick={() => onSortChange(columnKey)}
        className={cn(
          "flex h-full w-full items-center gap-1.5 py-2 text-[13px] font-medium transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground/70" aria-hidden />
        <span>{label}</span>
        {isActive ? (
          activeDirection === "asc" ? (
            <ArrowUp size={12} strokeWidth={2} className="ml-auto shrink-0 text-foreground/70" aria-hidden />
          ) : (
            <ArrowDown size={12} strokeWidth={2} className="ml-auto shrink-0 text-foreground/70" aria-hidden />
          )
        ) : null}
      </button>
    </div>
  );
}

interface Props {
  companies: DiscoverCompanyCard[];
  totalCount: number;
  selectedSlug: string | null;
  sortKey: CompanySortKey | null;
  sortDirection: CompanySortDirection;
  onSortChange: (key: CompanySortKey) => void;
  listScrollRef?: RefObject<HTMLDivElement | null>;
  desktopLoadMoreRef?: RefObject<HTMLDivElement | null>;
  mobileLoadMoreRef?: RefObject<HTMLDivElement | null>;
  hasMoreRows?: boolean;
  onOpen: (company: DiscoverCompanyCard) => void;
  starredIds: Set<string>;
  starPendingId: string | null;
  onToggleStar: (company: DiscoverCompanyCard) => void;
}

export function CompaniesRecordList({
  companies,
  totalCount,
  selectedSlug,
  sortKey,
  sortDirection,
  onSortChange,
  listScrollRef,
  desktopLoadMoreRef,
  mobileLoadMoreRef,
  hasMoreRows = false,
  onOpen,
  starredIds,
  starPendingId,
  onToggleStar,
}: Props) {
  if (totalCount === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-card p-8">
        <EmptyState
          title="No companies match your filters."
          description="Try clearing search or switching back to all industries to browse the full catalog."
          className="max-w-md border-none bg-transparent py-8"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <div
          className={cn(
            COMPANY_ROW_DESKTOP_GRID,
            "shrink-0 border-b border-border bg-muted/25",
          )}
        >
          <SortableHeaderCell
            label="Company"
            icon={Building2}
            columnKey="name"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <div
            className={cn(
              COMPANY_ROW_HEADER_CELL,
              "flex items-center gap-1.5 py-2 text-[13px] font-medium text-muted-foreground",
            )}
          >
            <Layers size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground/70" aria-hidden />
            Industry
          </div>
          <SortableHeaderCell
            label="Openings"
            icon={Briefcase}
            columnKey="openings"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <SortableHeaderCell
            label="Updated"
            icon={Clock}
            columnKey="updated"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
        </div>

        <div ref={listScrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <MotionStaggerList as="ul">
            {companies.map((company, index) => (
              <CompanyRow
                key={company.id}
                index={index}
                company={company}
                selected={selectedSlug === company.slug}
                starred={starredIds.has(company.id)}
                starPending={starPendingId === company.id}
                lazyLogo
                onOpen={() => onOpen(company)}
                onToggleStar={() => onToggleStar(company)}
                layout="desktop"
              />
            ))}
          </MotionStaggerList>
          {hasMoreRows ? (
            <div ref={desktopLoadMoreRef} className="h-8" aria-hidden="true" />
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-2">
          <p className="text-xs text-foreground/75">
            <span className="font-medium tabular-nums text-foreground">{totalCount}</span> count
          </p>
        </div>
      </div>

      <MotionStaggerList as="ul" className="divide-y divide-border md:hidden">
        {companies.map((company, index) => (
          <CompanyRow
            key={company.id}
            index={index}
            company={company}
            selected={selectedSlug === company.slug}
            starred={starredIds.has(company.id)}
            starPending={starPendingId === company.id}
            lazyLogo
            onOpen={() => onOpen(company)}
            onToggleStar={() => onToggleStar(company)}
            layout="mobile"
          />
        ))}
        {hasMoreRows ? (
          <li>
            <div ref={mobileLoadMoreRef} className="h-8" aria-hidden />
          </li>
        ) : null}
      </MotionStaggerList>
    </div>
  );
}
