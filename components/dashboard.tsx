"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Application } from "@/types/application";
import { type SeasonFilter } from "@/lib/config/season-filter";
import { STATUSES, STATUS_LABELS } from "@/lib/config/events";
import { deadlineStatusLabel, getNextActiveOaDeadline } from "@/lib/config/deadlines";
import { ApplicationsTable } from "@/components/applications-table";
import { ApplicationDialog, type CreatedApplicationSummary } from "@/components/application-dialog";
import { ApplicationDetail } from "@/components/application-detail";
import { StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageMain, PageShell } from "@/components/ui/page";
import { motionVariants } from "@/lib/ui/motion";
import { SearchInput } from "@/components/search-input";
import { updateApplicationArchive } from "@/lib/actions/applications";
import { normalizeApplicationState } from "@/lib/config/application-state";

type StatusFilter = "all" | (typeof STATUSES)[number];
type SortKey = "company" | "role" | "status" | "last_activity" | "deadline";
type SortDirection = "asc" | "desc";

const HIDE_REJECTED_STORAGE_KEY = "pathway:hide-rejected";
const HIDE_ARCHIVED_STORAGE_KEY = "pathway:hide-archived";
const SEARCH_TOKEN_PATTERN = /"[^"]*"|'[^']*'|\S+/g;

interface Props {
  applications: Application[];
}

function getSearchTerms(value: string) {
  return (value.match(SEARCH_TOKEN_PATTERN) ?? [])
    .map((term) => term.replace(/^["']|["']$/g, "").trim().toLowerCase())
    .filter(Boolean);
}

export function Dashboard({ applications: initialApplications }: Props) {
  const [applications, setApplications] = useState(initialApplications);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detail, setDetail]         = useState<Application | null>(null);
  const [query, setQuery]           = useState("");
  const searchParams = useSearchParams();
  const initialStatusFilter: StatusFilter = (() => {
    const raw = searchParams.get("status");
    if (!raw) return "all";
    return (STATUSES as readonly string[]).includes(raw) ? (raw as StatusFilter) : "all";
  })();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [hideRejected, setHideRejected] = useState(true);
  const [hideArchived, setHideArchived] = useState(true);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(
    () => new Set(applications.filter((app) => app.archived_at).map((app) => app.id)),
  );
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplications(initialApplications);
  }, [initialApplications]);

  useEffect(() => {
    const saved = window.localStorage.getItem(HIDE_REJECTED_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved !== null) setHideRejected(saved === "true");
  }, []);
  useEffect(() => {
    const saved = window.localStorage.getItem(HIDE_ARCHIVED_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved !== null) setHideArchived(saved === "true");
  }, []);
  useEffect(() => {
    window.localStorage.setItem(HIDE_REJECTED_STORAGE_KEY, String(hideRejected));
  }, [hideRejected]);
  useEffect(() => {
    window.localStorage.setItem(HIDE_ARCHIVED_STORAGE_KEY, String(hideArchived));
  }, [hideArchived]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArchivedIds(new Set(applications.filter((app) => app.archived_at).map((app) => app.id)));
  }, [applications]);

  const detailOpenRef = useRef(false);
  const dialogOpenRef = useRef(false);
  useEffect(() => { detailOpenRef.current = detail !== null; }, [detail]);
  useEffect(() => { dialogOpenRef.current = dialogOpen; }, [dialogOpen]);

  function focusCommandBar() {
    const input = searchInputRef.current?.querySelector("input");
    input?.focus();
    input?.select();
  }

  async function setApplicationArchived(applicationId: string, archived: boolean) {
    const previous = archivedIds;
    setArchivedIds((current) => {
      const next = new Set(current);
      if (archived) next.add(applicationId);
      else next.delete(applicationId);
      return next;
    });

    const result = await updateApplicationArchive(applicationId, archived);
    if (result?.error) {
      setArchivedIds(previous);
    }
  }

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (detailOpenRef.current || dialogOpenRef.current) return;
        focusCommandBar();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (detailOpenRef.current || dialogOpenRef.current) return;
      if (e.key === "/") {
        e.preventDefault();
        focusCommandBar();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setDialogOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function hasReachedStatus(application: Application, status: (typeof STATUSES)[number]) {
    return application.events.some((e) => e.event_type === status);
  }

  const searchTerms = useMemo(() => getSearchTerms(query), [query]);

  const filtered = useMemo(() => {
    return applications.filter((application) => {
      const isRejected = hasReachedStatus(application, "rejected");
      const isArchived = archivedIds.has(application.id);

      if (hideArchived && isArchived) return false;
      if (hideRejected && statusFilter !== "rejected" && isRejected) {
        return false;
      }
      if (statusFilter !== "all" && !hasReachedStatus(application, statusFilter)) return false;
      if (seasonFilter !== "all" && application.season !== seasonFilter) return false;

      const company = application.company.toLowerCase();
      const role = application.role.toLowerCase();
      const location = (application.location ?? "").toLowerCase();
      const haystack = [company, role, location].join(" ");

      if (searchTerms.length && !searchTerms.every((term) => haystack.includes(term))) return false;

      return true;
    });
  }, [
    applications,
    hideRejected,
    hideArchived,
    statusFilter,
    seasonFilter,
    archivedIds,
    searchTerms,
  ]);

  const sorted = useMemo(
    () => {
      const activeSortKey = sortKey ?? "last_activity";
      const activeSortDirection = sortKey ? sortDirection : "desc";

      return [...filtered].sort((a, b) => {
        let comparison = 0;
        switch (activeSortKey) {
          case "company":
            comparison = a.company.localeCompare(b.company);
            break;
          case "role":
            comparison = a.role.localeCompare(b.role);
            break;
          case "status":
            comparison = STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
            break;
          case "last_activity":
            comparison = a.last_activity_date.localeCompare(b.last_activity_date);
            break;
          case "deadline": {
            const aDeadline = getNextActiveOaDeadline(a);
            const bDeadline = getNextActiveOaDeadline(b);
            if (aDeadline && !bDeadline) comparison = -1;
            else if (!aDeadline && bDeadline) comparison = 1;
            else if (aDeadline && bDeadline) {
              comparison = aDeadline.deadlineDate.localeCompare(bDeadline.deadlineDate);
            }
            break;
          }
        }
        return activeSortDirection === "asc" ? comparison : -comparison;
      });
    },
    [filtered, sortKey, sortDirection],
  );

  const statusCounts = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((status) => [
          status,
          applications.filter((a) => hasReachedStatus(a, status)).length,
        ]),
      ) as Record<(typeof STATUSES)[number], number>,
    [applications],
  );

  const kpiCards = useMemo(
    () =>
      STATUSES.map((status) => ({
        status,
        label: STATUS_LABELS[status],
        count: statusCounts[status],
        active: statusFilter === status,
      })),
    [statusCounts, statusFilter],
  );

  useEffect(() => {
    if (!detail) return;
    const fresh = applications.find((a) => a.id === detail.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(fresh ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications]);

  function handleSortChange(nextKey: SortKey) {
    if (nextKey === "deadline") {
      setSortKey((current) => (current === "deadline" ? null : "deadline"));
      setSortDirection("asc");
      return;
    }
    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    setSortKey(null);
    setSortDirection("asc");
  }

  function handleApplicationCreated(created: CreatedApplicationSummary) {
    const now = new Date().toISOString();
    const application = normalizeApplicationState({
      id: created.id,
      user_id: "",
      company: created.company,
      role: created.role,
      posting_url: created.postingUrl,
      location: created.location,
      season: created.season,
      status: "applied",
      archived_at: null,
      created_at: now,
      last_activity_date: created.dateApplied,
      events: [created.appliedEvent],
    });
    setApplications((current) => [application, ...current]);
  }

  return (
    <PageShell>
      <PageMain width="lg">
        <motion.div variants={motionVariants.riseIn} initial={false} animate="visible">
          <PageHeader
            title="Applications"
            actions={
              <Button
                onClick={() => setDialogOpen(true)}
                className="h-11 rounded-md px-5 text-[13px] font-medium primary-surface"
              >
                <Plus size={14} strokeWidth={2} />
                Add application
              </Button>
            }
          />
        </motion.div>

        <motion.div
          className={`relative ${searchFocused ? "z-[200]" : "z-20"}`}
          variants={motionVariants.fadeIn}
          initial={false}
          animate="visible"
        >
          <span className="rule mb-0" />
          <motion.div
            variants={motionVariants.list}
            initial={false}
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-5 divide-x"
            style={{ borderColor: "var(--rule)" }}
          >
            {kpiCards.map(({ status, label, count, active }) => (
              <motion.button
                key={status}
                type="button"
                onClick={() => setStatusFilter((prev) => (prev === status ? "all" : status))}
                variants={motionVariants.row}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                className={`group relative p-6 text-left transition-colors duration-200 ${
                  active
                    ? "bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]"
                    : "hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)]"
                }`}
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <StatusDot status={status} size={6} />
                  <span className="figure-label">{label}</span>
                </div>
                <div className="figure-number relative overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={`${status}-${count}`}
                      variants={motionVariants.step}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="inline-block"
                    >
                      {count}
                    </motion.span>
                  </AnimatePresence>
                </div>
                {active && (
                  <motion.span
                    layoutId="status-filter-underline"
                    className="absolute left-0 bottom-0 h-[2px] w-full"
                    style={{ background: "var(--primary)" }}
                  />
                )}
              </motion.button>
            ))}
          </motion.div>
          <span className="rule" />

          <div className="mt-6 mb-4">
            <div ref={searchInputRef} className="relative z-[210]">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search company, role, or location…"
                onFocusChange={setSearchFocused}
              />
            </div>
          </div>

        </motion.div>

        <ApplicationsTable
          applications={sorted}
          matchingCount={filtered.length}
          activeCount={applications.length - archivedIds.size}
          archivedCount={archivedIds.size}
          hasActiveFilters={Boolean(query || statusFilter !== "all" || seasonFilter !== "all")}
          searchQuery={query}
          onOpen={setDetail}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          getDeadlineLabel={(application) => {
            const deadline = getNextActiveOaDeadline(application);
            return deadline ? deadlineStatusLabel(deadline) : null;
          }}
          hideRejected={hideRejected}
          onHideRejectedChange={setHideRejected}
          hideArchived={hideArchived}
          onHideArchivedChange={setHideArchived}
          seasonFilter={seasonFilter}
          onSeasonFilterChange={setSeasonFilter}
          archivedIds={archivedIds}
          onArchiveChange={setApplicationArchived}
        />
      </PageMain>

      <ApplicationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleApplicationCreated}
      />
      <ApplicationDetail application={detail} onClose={() => setDetail(null)} />
    </PageShell>
  );
}
