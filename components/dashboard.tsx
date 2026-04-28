"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { Application, ApplicationSeason } from "@/types/application";
import { STATUSES, STATUS_LABELS } from "@/lib/config/events";
import { ApplicationsTable } from "@/components/applications-table";
import { ApplicationDialog, type CreatedApplicationSummary } from "@/components/application-dialog";
import { ApplicationDetail } from "@/components/application-detail";
import { StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { FilterChip, FilterOption } from "@/components/ui/filter-chip";
import { motionVariants } from "@/lib/ui/motion";
import { getFieldTerms, getLastFieldTerm, hasAnyFlag, parseCommandQuery } from "@/lib/ui/query";
import { type QuerySuggestion } from "@/components/query-autocomplete";
import { TokenizedQueryInput } from "@/components/tokenized-query-input";
import { updateApplicationArchive } from "@/lib/actions/applications";
import { normalizeApplicationState } from "@/lib/config/application-state";

type StatusFilter = "all" | (typeof STATUSES)[number];
type SeasonFilter = "all" | ApplicationSeason;
type SortKey = "company" | "role" | "status" | "last_activity";
type SortDirection = "asc" | "desc";

const HIDE_REJECTED_STORAGE_KEY = "launchpad:hide-rejected";
const HIDE_ARCHIVED_STORAGE_KEY = "launchpad:hide-archived";

const DASHBOARD_QUERY_SUGGESTIONS: QuerySuggestion[] = [
  { token: "status:applied", label: "Status: Applied", hint: "Applications that have reached applied" },
  { token: "status:oa", label: "Status: OA", hint: "Applications with an online assessment" },
  { token: "status:interview", label: "Status: Interview", hint: "Applications with interview activity" },
  { token: "status:offer", label: "Status: Offer", hint: "Applications with an offer" },
  { token: "status:rejected", label: "Status: Rejected", hint: "Applications marked rejected" },
  { token: "season:summer", label: "Season: Summer", hint: "Summer applications only" },
  { token: "season:fall", label: "Season: Fall", hint: "Fall applications only" },
  { token: "sort:company", label: "Sort by company", hint: "Alphabetize the visible queue" },
  { token: "sort:role", label: "Sort by role", hint: "Group similar roles together" },
  { token: "sort:recent", label: "Sort by recent", hint: "Most recently active first" },
  { token: "dir:asc", label: "Direction: Asc", hint: "Ascending sort direction" },
  { token: "dir:desc", label: "Direction: Desc", hint: "Descending sort direction" },
  { token: "company:", label: "Company filter", hint: "Example: company:citadel" },
  { token: "role:", label: "Role filter", hint: "Example: role:quant" },
  { token: "location:", label: "Location filter", hint: "Example: location:nyc" },
  { token: "has:url", label: "Has posting URL", hint: "Only applications with links" },
  { token: "archived", label: "Archived lane", hint: "Show applications you archived" },
  { token: "active", label: "Active lane", hint: "Hide archived applications" },
];

const SEASON_FILTER_OPTIONS: FilterOption<SeasonFilter>[] = [
  { value: "all", label: "All" },
  { value: "Summer", label: "Summer" },
  { value: "Fall", label: "Fall" },
];

interface Props {
  applications: Application[];
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

  const parsedQuery = useMemo(() => parseCommandQuery(query), [query]);
  const tokenStatus = getLastFieldTerm(parsedQuery, "status");
  const tokenSeason = getLastFieldTerm(parsedQuery, "season");
  const tokenSort = getLastFieldTerm(parsedQuery, "sort");
  const tokenDir = getLastFieldTerm(parsedQuery, "dir");
  const commandStatusFilter =
    tokenStatus && (STATUSES as readonly string[]).includes(tokenStatus)
      ? (tokenStatus as StatusFilter)
      : statusFilter;
  const commandSeasonFilter =
    tokenSeason === "summer" || tokenSeason === "fall"
      ? ((tokenSeason[0].toUpperCase() + tokenSeason.slice(1)) as SeasonFilter)
      : seasonFilter;
  const commandSortKey: SortKey | null =
    tokenSort === "company" || tokenSort === "role" || tokenSort === "status"
      ? tokenSort
      : tokenSort === "last" || tokenSort === "recent" || tokenSort === "activity"
        ? "last_activity"
        : sortKey;
  const commandSortDirection: SortDirection =
    tokenDir === "desc" || tokenDir === "asc" ? tokenDir : sortDirection;
  const showArchivedOnly = hasAnyFlag(parsedQuery, "archived", "archive");
  const showActiveOnly = hasAnyFlag(parsedQuery, "active");
  const companyTerms = getFieldTerms(parsedQuery, "company");
  const roleTerms = getFieldTerms(parsedQuery, "role");
  const locationTerms = getFieldTerms(parsedQuery, "location", "loc");
  const hasTerms = getFieldTerms(parsedQuery, "has");
  const freeTextTerms = parsedQuery.textTerms.filter(
    (term) =>
      !["archived", "archive", "active"].includes(term) &&
      !(STATUSES as readonly string[]).includes(term),
  );

  const filtered = useMemo(() => {
    return applications.filter((application) => {
      const isRejected = hasReachedStatus(application, "rejected");
      const isArchived = archivedIds.has(application.id);

      if (showArchivedOnly && !isArchived) return false;
      if (showActiveOnly && isArchived) return false;
      if (!showArchivedOnly && !showActiveOnly && hideArchived && isArchived) return false;
      if (hideRejected && commandStatusFilter !== "rejected" && isRejected) {
        return false;
      }
      if (commandStatusFilter !== "all" && !hasReachedStatus(application, commandStatusFilter)) return false;
      if (commandSeasonFilter !== "all" && application.season !== commandSeasonFilter) return false;

      const company = application.company.toLowerCase();
      const role = application.role.toLowerCase();
      const location = (application.location ?? "").toLowerCase();
      const haystack = [company, role, location].join(" ");

      if (companyTerms.length && !companyTerms.every((term) => company.includes(term))) return false;
      if (roleTerms.length && !roleTerms.every((term) => role.includes(term))) return false;
      if (locationTerms.length && !locationTerms.every((term) => location.includes(term))) return false;
      if (freeTextTerms.length && !freeTextTerms.every((term) => haystack.includes(term))) return false;
      if (hasTerms.includes("url") && !application.posting_url) return false;
      if (hasTerms.includes("location") && !application.location) return false;

      return true;
    });
  }, [
    applications,
    hideRejected,
    hideArchived,
    commandStatusFilter,
    commandSeasonFilter,
    archivedIds,
    showArchivedOnly,
    showActiveOnly,
    companyTerms,
    roleTerms,
    locationTerms,
    freeTextTerms,
    hasTerms,
  ]);

  const sorted = useMemo(
    () => {
      const activeSortKey = commandSortKey ?? "last_activity";
      const activeSortDirection = commandSortKey ? commandSortDirection : "desc";

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
        }
        return activeSortDirection === "asc" ? comparison : -comparison;
      });
    },
    [filtered, commandSortKey, commandSortDirection],
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
        active: commandStatusFilter === status,
      })),
    [statusCounts, commandStatusFilter],
  );

  useEffect(() => {
    if (!detail) return;
    const fresh = applications.find((a) => a.id === detail.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(fresh ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications]);

  function handleSortChange(nextKey: SortKey) {
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
      events: [
        {
          id: `local-${created.id}-applied`,
          application_id: created.id,
          event_type: "applied",
          event_date: created.dateApplied,
          notes: null,
          round_number: null,
          created_at: now,
        },
      ],
    });
    setApplications((current) => [application, ...current]);
  }

  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 pt-24 sm:pt-28 lg:pt-32 pb-24">
        <motion.header className="masthead mb-12" variants={motionVariants.riseIn} initial="hidden" animate="visible">
          <div className="flex items-baseline justify-between pb-4">
            <span className="label-micro">Pipeline</span>
            <span className="label-meta hidden sm:inline">{applications.length} total · {filtered.length} shown</span>
          </div>
          <span className="rule-strong" />
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="display-serif text-[4.5rem] sm:text-[5.25rem] lg:text-[6rem] text-foreground">
                Applications
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                Every application you&rsquo;re tracking, with live status and event history.
              </p>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              className="h-11 rounded-md px-5 text-[13px] font-medium primary-surface"
            >
              <Plus size={14} strokeWidth={2} />
              Add application
            </Button>
          </div>
        </motion.header>

        <motion.div
          className={`relative mb-10 ${searchFocused ? "z-[200]" : "z-20"}`}
          variants={motionVariants.fadeIn}
          initial="hidden"
          animate="visible"
        >
          <span className="rule mb-0" />
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x" style={{ borderColor: "var(--rule)" }}>
            {kpiCards.map(({ status, label, count, active }) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter((prev) => (prev === status ? "all" : status))}
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
                <motion.div
                  key={`${status}-${count}`}
                  initial={{ opacity: 0.5, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="figure-number"
                >
                  {count}
                </motion.div>
                {active && (
                  <span
                    className="absolute left-0 bottom-0 h-[2px] w-full"
                    style={{ background: "var(--primary)" }}
                  />
                )}
              </button>
            ))}
          </div>
          <span className="rule" />

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div ref={searchInputRef} className="relative z-[210] flex-1">
              <TokenizedQueryInput
                value={query}
                onChange={setQuery}
                suggestions={DASHBOARD_QUERY_SUGGESTIONS}
                placeholder="Search company, role, or location…"
                focused={searchFocused}
                onFocusChange={setSearchFocused}
              />
            </div>
            <div className="flex items-center gap-2">
              <FilterChip
                label="Season"
                value={seasonFilter}
                onChange={setSeasonFilter}
                defaultValue="all"
                options={SEASON_FILTER_OPTIONS}
              />
              {showArchivedOnly && (
                <button
                  type="button"
                  onClick={() => setQuery((current) => current.replace(/\barchived\b/g, "").replace(/\s+/g, " ").trim())}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <ArchiveRestore size={12} strokeWidth={1.75} />
                  Exit archive
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 label-meta">
            <span>
              <span className="text-foreground tabular">{filtered.length}</span> matching
            </span>
            <span className="opacity-50">·</span>
            <span>
              <span className="text-foreground tabular">{applications.length - archivedIds.size}</span> active
            </span>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Archive size={11} strokeWidth={1.75} />
              <span className="text-foreground tabular">{archivedIds.size}</span> archived
            </span>
          </div>
        </motion.div>

        <ApplicationsTable
          applications={sorted}
          hasActiveFilters={Boolean(query || statusFilter !== "all" || seasonFilter !== "all")}
          searchQuery={query}
          onOpen={setDetail}
          sortKey={commandSortKey}
          sortDirection={commandSortDirection}
          onSortChange={handleSortChange}
          hideRejected={hideRejected}
          onHideRejectedChange={setHideRejected}
          hideArchived={hideArchived}
          onHideArchivedChange={setHideArchived}
          archivedIds={archivedIds}
          onArchiveChange={setApplicationArchived}
        />
      </main>

      <ApplicationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleApplicationCreated}
      />
      <ApplicationDetail application={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
