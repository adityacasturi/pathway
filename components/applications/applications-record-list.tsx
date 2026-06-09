"use client";

import { useEffect, type RefObject } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import type { Application } from "@/types/application";
import type {
  CompanyLogoAssetByName,
  CompanySlugByName,
  CompanyWebsiteByName,
} from "@/lib/logo/company-website-lookup";
import {
  lookupCompanyLogoAssetKey,
  lookupCompanySlug,
  lookupCompanyWebsiteUrl,
} from "@/lib/logo/company-website-lookup";
import { formatCompactLocationLabel } from "@/lib/feed/us-locations";
import { safeExternalHref } from "@/lib/url";
import { LINK_MUTED_CLASS } from "@/lib/ui/link-styles";
import { cn, formatDate } from "@/lib/utils";
import { CompanyLogo } from "@/components/company-logo";
import { SeasonBadge } from "@/components/season-badge";
import { StatusBadge } from "@/components/status-badge";
import { MotionStaggerItem, MotionStaggerList } from "@/components/design-system/motion-stagger";
import { EmptyState } from "@/components/design-system/states";

type SortKey = "company" | "role" | "location" | "season" | "status" | "last_activity";
type SortDirection = "asc" | "desc";

const DESKTOP_GRID =
  "grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,0.55fr)_minmax(0,0.65fr)_minmax(0,0.6fr)] items-stretch";

function SortableHeaderCell({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSortChange,
  align = "left",
}: {
  label: string;
  columnKey: SortKey;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  align?: "left" | "center";
}) {
  const activeKey = sortKey ?? "last_activity";
  const activeDirection = sortKey ? sortDirection : "desc";
  const isActive = activeKey === columnKey;

  return (
    <div className="border-r border-border/70 px-2 py-0 last:border-r-0">
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
          "flex h-full w-full items-center gap-1 px-2 py-2.5 text-xs font-medium transition-colors",
          align === "center" ? "justify-center" : "justify-start",
          isActive ? "text-foreground" : "text-foreground/75 hover:text-foreground",
        )}
      >
        <span>{label}</span>
        {isActive ? (
          activeDirection === "asc" ? (
            <ArrowUp size={12} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden />
          ) : (
            <ArrowDown size={12} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden />
          )
        ) : null}
      </button>
    </div>
  );
}

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 border-r border-border/50 px-4 py-0 last:border-r-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface Props {
  applications: Application[];
  totalCount: number;
  companyWebsiteByName?: CompanyWebsiteByName;
  companySlugByName?: CompanySlugByName;
  companyLogoAssetByName?: CompanyLogoAssetByName;
  hasActiveFilters: boolean;
  searchQuery: string;
  onCreateApplication: () => void;
  onOpen: (app: Application) => void;
  selectedId?: string | null;
  archivedIds: Set<string>;
  loadMoreRef?: RefObject<HTMLDivElement | null>;
  hasMoreRows?: boolean;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
}

export function ApplicationsRecordList({
  applications,
  totalCount,
  companyWebsiteByName = {},
  companySlugByName = {},
  companyLogoAssetByName = {},
  hasActiveFilters,
  searchQuery,
  onCreateApplication,
  onOpen,
  selectedId = null,
  archivedIds,
  loadMoreRef,
  hasMoreRows = false,
  sortKey,
  sortDirection,
  onSortChange,
}: Props) {
  useEffect(() => {
    if (applications.length === 0) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key !== "j" && key !== "k" && key !== "enter") return;
      const currentIndex = selectedId
        ? applications.findIndex((app) => app.id === selectedId)
        : -1;
      if (key === "enter" && currentIndex >= 0) {
        event.preventDefault();
        onOpen(applications[currentIndex]!);
        return;
      }
      if (key === "j" || key === "k") {
        event.preventDefault();
        const delta = key === "j" ? 1 : -1;
        const nextIndex =
          currentIndex < 0
            ? delta > 0
              ? 0
              : applications.length - 1
            : Math.min(Math.max(currentIndex + delta, 0), applications.length - 1);
        onOpen(applications[nextIndex]!);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applications, onOpen, selectedId]);

  if (applications.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-card p-8">
        <EmptyState
          key={hasActiveFilters ? "filtered-empty" : "base-empty"}
          title={hasActiveFilters ? "No matches" : "No applications yet"}
          description={
            hasActiveFilters
              ? `Nothing matches "${searchQuery.trim()}". Clear filters or broaden your search.`
              : "Track a role from Openings or add one manually to start your pipeline."
          }
          primaryAction={
            !hasActiveFilters
              ? { label: "Add application", onClick: onCreateApplication, icon: <Plus size={14} /> }
              : undefined
          }
          secondaryAction={
            !hasActiveFilters ? { label: "Browse openings", href: "/openings" } : undefined
          }
          className="max-w-md border-none bg-transparent py-8"
        />
      </div>
    );
  }

  return (
    <>
      <div className="hidden h-full min-h-0 flex-col bg-card md:flex">
        <div
          className={cn(
            DESKTOP_GRID,
            "shrink-0 border-b border-border bg-muted/25",
          )}
        >
          <SortableHeaderCell
            label="Company"
            columnKey="company"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <SortableHeaderCell
            label="Role"
            columnKey="role"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <SortableHeaderCell
            label="Location"
            columnKey="location"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <SortableHeaderCell
            label="Season"
            columnKey="season"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
            align="center"
          />
          <SortableHeaderCell
            label="Status"
            columnKey="status"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
            align="center"
          />
          <SortableHeaderCell
            label="Updated"
            columnKey="last_activity"
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <MotionStaggerList as="ul">
            {applications.map((application, index) => (
              <RecordRow
                key={application.id}
                index={index}
                application={application}
                archived={archivedIds.has(application.id)}
                selected={selectedId === application.id}
                companyWebsiteByName={companyWebsiteByName}
                companySlugByName={companySlugByName}
                companyLogoAssetByName={companyLogoAssetByName}
                onOpen={() => onOpen(application)}
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
        {applications.map((application, index) => (
          <RecordRow
            key={application.id}
            index={index}
            application={application}
            archived={archivedIds.has(application.id)}
            selected={selectedId === application.id}
            companyWebsiteByName={companyWebsiteByName}
            companySlugByName={companySlugByName}
            companyLogoAssetByName={companyLogoAssetByName}
            onOpen={() => onOpen(application)}
            layout="mobile"
          />
        ))}
      </MotionStaggerList>
    </>
  );
}

function RecordRow({
  application,
  archived,
  selected,
  companyWebsiteByName,
  companySlugByName,
  companyLogoAssetByName,
  onOpen,
  layout,
  index,
}: {
  application: Application;
  archived: boolean;
  selected: boolean;
  index: number;
  companyWebsiteByName: CompanyWebsiteByName;
  companySlugByName: CompanySlugByName;
  companyLogoAssetByName: CompanyLogoAssetByName;
  onOpen: () => void;
  layout: "desktop" | "mobile";
}) {
  const postingHref = safeExternalHref(application.posting_url);
  const locationRaw = application.location?.trim() ?? "";
  const locationLabel = locationRaw
    ? (formatCompactLocationLabel(locationRaw, 1) ?? locationRaw)
    : "—";

  if (layout === "mobile") {
    return (
      <MotionStaggerItem as="li" index={index}>
        <button
          type="button"
          data-testid="application-row"
          data-company={application.company}
          onClick={onOpen}
          className={cn(
            "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/35",
            selected && "bg-muted/55",
            archived && "opacity-55",
          )}
        >
          <CompanyLogo
            company={application.company}
            companySlug={lookupCompanySlug(application.company, companySlugByName)}
            logoAssetKey={lookupCompanyLogoAssetKey(application.company, companyLogoAssetByName)}
            websiteUrl={lookupCompanyWebsiteUrl(application.company, companyWebsiteByName)}
            size={32}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{application.company}</p>
            <p className="truncate text-xs text-foreground/75">{application.role}</p>
          </div>
          {application.season ? (
            <SeasonBadge season={application.season} variant="plain" />
          ) : null}
          <StatusBadge status={application.status} variant="plain" />
        </button>
      </MotionStaggerItem>
    );
  }

  return (
    <MotionStaggerItem as="li" index={index}>
      <button
        type="button"
        data-testid="application-row"
        data-company={application.company}
        onClick={onOpen}
        className={cn(
          DESKTOP_GRID,
          "w-full min-h-[2.75rem] border-b border-border/60 text-left transition-colors hover:bg-muted/30",
          selected && "bg-muted/50",
          archived && "opacity-55",
        )}
      >
        <TableCell>
          <span className="flex min-w-0 items-center gap-2.5 py-2.5">
            <CompanyLogo
              company={application.company}
              companySlug={lookupCompanySlug(application.company, companySlugByName)}
              logoAssetKey={lookupCompanyLogoAssetKey(application.company, companyLogoAssetByName)}
              websiteUrl={lookupCompanyWebsiteUrl(application.company, companyWebsiteByName)}
              size={24}
            />
            <span className="truncate text-sm font-medium text-foreground">{application.company}</span>
          </span>
        </TableCell>
        <TableCell>
          {postingHref ? (
            <a
              href={postingHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className={cn("block truncate py-2.5 text-sm", LINK_MUTED_CLASS)}
            >
              {application.role}
            </a>
          ) : (
            <span className="block truncate py-2.5 text-sm text-foreground/90">{application.role}</span>
          )}
        </TableCell>
        <TableCell>
          <span
            className="block truncate py-2.5 text-sm text-foreground/80"
            title={locationRaw || undefined}
          >
            {locationLabel}
          </span>
        </TableCell>
        <TableCell className="flex justify-center">
          <span className="flex py-2.5">
            {application.season ? (
              <SeasonBadge season={application.season} variant="plain" />
            ) : null}
          </span>
        </TableCell>
        <TableCell className="flex justify-center">
          <span className="flex py-2.5">
            <StatusBadge status={application.status} variant="plain" />
          </span>
        </TableCell>
        <TableCell>
          <span className="block truncate py-2.5 text-sm tabular-nums text-foreground/80">
            {formatDate(application.last_activity_date)}
          </span>
        </TableCell>
      </button>
    </MotionStaggerItem>
  );
}
