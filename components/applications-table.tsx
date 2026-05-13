"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Application } from "@/types/application";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArchiveRestore, CircleDot, ExternalLink, ListFilter, SlidersHorizontal } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { safeExternalHref } from "@/lib/url";
import { deleteApplication } from "@/lib/actions/applications";
import { CompanyLogo } from "@/components/company-logo";
import { SeasonPill } from "@/components/season-pill";
import { StatusBadge } from "@/components/status-badge";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motionVariants, transitions } from "@/lib/ui/motion";

type SortKey = "company" | "role" | "status" | "last_activity" | "deadline";
type SortDirection = "asc" | "desc";

interface Props {
  applications: Application[];
  matchingCount: number;
  activeCount: number;
  archivedCount: number;
  hasActiveFilters: boolean;
  searchQuery: string;
  onOpen: (app: Application) => void;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  getDeadlineLabel: (app: Application) => string | null;
  hideRejected: boolean;
  onHideRejectedChange: (next: boolean) => void;
  hideArchived: boolean;
  onHideArchivedChange: (next: boolean) => void;
  archivedIds: Set<string>;
  onArchiveChange: (applicationId: string, archived: boolean) => void;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "last_activity", label: "Recent" },
  { key: "deadline", label: "Deadline" },
];

function SortToolbar({
  matchingCount,
  activeCount,
  archivedCount,
  sortKey,
  sortDirection,
  onSortChange,
  hideRejected,
  onHideRejectedChange,
  hideArchived,
  onHideArchivedChange,
}: {
  matchingCount: number;
  activeCount: number;
  archivedCount: number;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey) => void;
  hideRejected: boolean;
  onHideRejectedChange: (next: boolean) => void;
  hideArchived: boolean;
  onHideArchivedChange: (next: boolean) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const activeFilterCount = Number(hideRejected) + Number(hideArchived);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !filtersRef.current?.contains(event.target)) {
        setFiltersOpen(false);
      }
    }

    if (!filtersOpen) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [filtersOpen]);

  return (
    <motion.div
      layout
      className="flex flex-col gap-3 border-y py-3 md:flex-row md:items-center md:justify-between"
      style={{ borderColor: "var(--rule)" }}
      transition={transitions.layout}
    >
      <div className="flex flex-wrap items-center gap-2" aria-label="Application counts">
        <SummaryPill value={matchingCount} label="Matching" icon={<ListFilter size={12} strokeWidth={1.75} />} />
        <SummaryPill value={activeCount} label="Active" icon={<CircleDot size={12} strokeWidth={1.75} />} />
        <SummaryPill value={archivedCount} label="Archived" icon={<Archive size={12} strokeWidth={1.75} />} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="inline-flex w-fit items-center rounded-md border bg-background p-1" style={{ borderColor: "var(--rule)" }}>
          <span className="hidden px-2 text-[11px] text-muted-foreground sm:inline">Sort</span>
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onSortChange(opt.key)}
                className={`relative inline-flex h-7 items-center gap-1 rounded-sm px-2.5 text-[12px] transition-colors duration-200 ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="application-sort-active"
                    className="absolute inset-0 rounded-sm bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]"
                    transition={transitions.layout}
                  />
                )}
                <span className="relative">{opt.label}</span>
                {active && (
                  <span className="relative font-mono text-[10px] leading-none opacity-70">
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div ref={filtersRef} className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className="inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground aria-expanded:text-foreground"
            style={{ borderColor: activeFilterCount > 0 || filtersOpen ? "var(--rule-strong)" : "var(--rule)" }}
          >
            <SlidersHorizontal size={13} strokeWidth={1.75} />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                variants={motionVariants.menu}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute right-0 top-[calc(100%+8px)] z-[90] w-56 origin-top-right rounded-md border bg-popover p-2 shadow-[0_18px_40px_-28px_color-mix(in_oklab,var(--ink)_45%,transparent)]"
                style={{ borderColor: "var(--rule-strong)" }}
              >
                <FilterMenuToggle
                  label="Hide rejected"
                  checked={hideRejected}
                  onChange={onHideRejectedChange}
                />
                <FilterMenuToggle
                  label="Hide archived"
                  checked={hideArchived}
                  onChange={onHideArchivedChange}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function SummaryPill({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <motion.span
      layout
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 text-[12px] text-muted-foreground"
      style={{ borderColor: "var(--rule)" }}
      transition={transitions.layout}
    >
      {icon ? (
        <span className="inline-flex size-3.5 items-center justify-center" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="relative inline-flex justify-end overflow-hidden font-mono text-[12px] text-foreground tabular">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            variants={motionVariants.step}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      {label}
    </motion.span>
  );
}

function FilterMenuToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center justify-between gap-4 rounded-sm px-2 py-2 text-[12px] text-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3 rounded-[2px] accent-foreground cursor-pointer"
      />
    </label>
  );
}

export function ApplicationsTable({
  applications,
  matchingCount,
  activeCount,
  archivedCount,
  hasActiveFilters,
  searchQuery,
  onOpen,
  sortKey,
  sortDirection,
  onSortChange,
  getDeadlineLabel,
  hideRejected,
  onHideRejectedChange,
  hideArchived,
  onHideArchivedChange,
  archivedIds,
  onArchiveChange,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; app: Application } | null>(null);
  const [confirmDeleteApp, setConfirmDeleteApp] = useState<Application | null>(null);
  const [deleteState, setDeleteState] = useState<"idle" | "pending">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function handleDeleteConfirmed() {
    if (!confirmDeleteApp) return;
    setDeleteError(null);
    setDeleteState("pending");
    const result = await deleteApplication(confirmDeleteApp.id);
    if (result?.error) {
      setDeleteError(result.error);
      setDeleteState("idle");
      return;
    }
    setDeleteState("idle");
    setConfirmDeleteApp(null);
  }

  return (
    <motion.div layout initial={false} animate={{ opacity: 1 }} transition={transitions.layout}>
      <SortToolbar
        matchingCount={matchingCount}
        activeCount={activeCount}
        archivedCount={archivedCount}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={onSortChange}
        hideRejected={hideRejected}
        onHideRejectedChange={onHideRejectedChange}
        hideArchived={hideArchived}
        onHideArchivedChange={onHideArchivedChange}
      />

      {applications.length === 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={hasActiveFilters ? "filtered-empty" : "base-empty"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col items-center justify-center py-28 text-center"
          >
            <p className="display-serif text-[22px] text-foreground/80">
              {hasActiveFilters ? "Nothing matches." : "No applications yet."}
            </p>
            <p className="mt-3 text-[13px] text-muted-foreground/70">
              {hasActiveFilters ? `Try clearing "${searchQuery.trim()}" or the filters above.` : "Press N to add your first one."}
            </p>
          </motion.div>
        </AnimatePresence>
      )}

      <ul
        className="divide-y"
        style={{ borderColor: "var(--rule)" }}
      >
        {applications.map((app) => {
          const postingHref = safeExternalHref(app.posting_url);
          const archived = archivedIds.has(app.id);
          const deadlineLabel = getDeadlineLabel(app);
          return (
            <li
              key={app.id}
              data-testid="application-row"
              data-company={app.company}
              onClick={() => onOpen(app)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, app });
              }}
              className={`group cursor-pointer select-none smooth-surface hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)] ${
                archived ? "opacity-60" : ""
              }`}
            >
              <div className="grid min-h-[76px] grid-cols-[2.125rem_minmax(0,1fr)_5.75rem] items-center gap-x-4 px-2 py-4 md:grid-cols-[2.125rem_minmax(12rem,22rem)_minmax(0,14rem)_minmax(1rem,1fr)_5.75rem_6.75rem] lg:grid-cols-[2.125rem_minmax(14rem,24rem)_minmax(0,16rem)_minmax(1rem,1fr)_5.75rem_6.75rem]">
                  <CompanyLogo company={app.company} size={34} />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                      <span className="truncate font-medium text-foreground/80">{app.company}</span>
                      {app.season && <SeasonPill season={app.season} />}
                      {archived && (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                          <Archive size={9} strokeWidth={1.75} />
                          Archived
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 min-w-0">
                      <span className="truncate text-[15px] font-medium text-foreground">{app.role}</span>
                      {deadlineLabel && (
                        <span
                          title={`OA deadline: ${deadlineLabel}`}
                          className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground"
                          style={{ borderColor: "var(--rule)" }}
                        >
                          {deadlineLabel}
                        </span>
                      )}
                      {postingHref && (
                        <a
                          href={postingHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={`Open posting: ${app.posting_url}`}
                          className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
                        >
                          <ExternalLink size={13} strokeWidth={1.75} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="hidden min-w-0 text-[12px] font-medium text-muted-foreground md:block">
                    <span className="block truncate">{app.location ?? ""}</span>
                  </div>

                  <div className="hidden min-w-0 md:block" aria-hidden />

                  <div>
                    <StatusBadge status={app.status} variant="compact" />
                  </div>

                  <div className="hidden text-right label-meta font-medium tabular md:block">
                    {formatDate(app.last_activity_date)}
                  </div>
                </div>
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            className="fixed z-70 min-w-44 origin-top-left rounded-lg border bg-popover p-1 shadow-[0_18px_45px_-28px_color-mix(in_oklab,var(--ink)_55%,transparent)]"
            style={{ left: contextMenu.x, top: contextMenu.y, borderColor: "var(--rule-strong)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              data-testid="application-context-delete"
              onClick={() => {
                onArchiveChange(contextMenu.app.id, !archivedIds.has(contextMenu.app.id));
                setContextMenu(null);
              }}
              className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] hover:text-foreground"
            >
              {archivedIds.has(contextMenu.app.id) ? <ArchiveRestore size={13} strokeWidth={1.75} /> : <Archive size={13} strokeWidth={1.75} />}
              {archivedIds.has(contextMenu.app.id) ? "Unarchive application" : "Archive application"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDeleteApp(contextMenu.app);
                setDeleteError(null);
                setContextMenu(null);
              }}
              className="h-9 w-full rounded-md px-3 text-left text-[13px] text-destructive transition-colors duration-150 hover:bg-destructive/10"
            >
              Delete application
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={Boolean(confirmDeleteApp)}
        onOpenChange={(open) => {
          if (open) return;
          setConfirmDeleteApp(null);
          setDeleteError(null);
        }}
      >
        <DialogContent className="max-w-md gap-0 rounded-xl border bg-popover p-7" showCloseButton={false} style={{ borderColor: "var(--rule-strong)" }}>
          <DialogHeader className="mb-4">
            <DialogTitle className="display-serif text-[22px] font-normal text-foreground">Delete application?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] leading-relaxed text-muted-foreground mb-6">
            This will permanently remove{" "}
            <span className="text-foreground font-medium">{confirmDeleteApp?.company}</span> and its timeline of events.
          </p>
          {deleteError && (
            <div className="mb-4">
              <InlineError message={deleteError} onRetry={() => setDeleteError(null)} />
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirmDeleteApp(null);
                setDeleteError(null);
              }}
              className="h-9 px-4 text-[12px]"
            >
              Cancel
            </Button>
            <AsyncButton
              type="button"
              data-testid="confirm-delete-application"
              state={deleteState}
              idleLabel="Delete"
              pendingLabel="Deleting"
              onClick={handleDeleteConfirmed}
              className="h-9 px-5 text-[12px] font-medium bg-destructive/15 text-destructive hover:bg-destructive/25"
            />
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
