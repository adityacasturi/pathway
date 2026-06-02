"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, RefreshCw } from "lucide-react";
import { ApplicationDialog } from "@/components/application-dialog";
import { HomeSnapshot } from "@/components/home/home-snapshot";
import { PostingRow } from "@/components/posting-row";
import { InlineError } from "@/components/ui/inline-error";
import { PageHeader, PageMain, PageSection, PageShell } from "@/components/ui/page";
import { createApplication } from "@/lib/actions/applications";
import {
  dismissPosting,
  refreshFeed,
  savePosting,
  undismissPosting,
  unsavePosting,
} from "@/lib/actions/feed";
import {
  buildTrackApplicationFormData,
  feedSeasonToApplicationSeason,
} from "@/lib/feed/build-track-form-data";
import { applyInteractionIds, hasAnyInteraction } from "@/lib/feed/interactions";
import {
  HOME_MAX_NEW_ROWS,
  HOME_MAX_SAVED_ROWS,
  type HomeBriefing,
  type StarredPostingAlert,
} from "@/lib/home/briefing";
import { getPageLabel } from "@/lib/config/nav";
import { motionVariants } from "@/lib/ui/motion";
import { normalizeUrl } from "@/lib/url";
import type { FeedPosting } from "@/lib/feed/source";
import type { Application, ApplicationSeason } from "@/types/application";

interface Props {
  applications: Application[];
  briefing: HomeBriefing;
  starredCompanyCount: number;
  newPostings: FeedPosting[];
  dismissedIds: string[];
  savedIds: string[];
  savedPostings: FeedPosting[];
  trackedUrls: string[];
  quickTrackEnabled?: boolean;
}

interface Prefill {
  company: string;
  role: string;
  posting_url: string;
  location: string;
  season?: ApplicationSeason;
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[17px] font-medium text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function Home({
  applications,
  briefing,
  starredCompanyCount,
  newPostings,
  dismissedIds,
  savedIds,
  savedPostings,
  trackedUrls,
  quickTrackEnabled = false,
}: Props) {
  const router = useRouter();
  const [dialogPrefill, setDialogPrefill] = useState<Prefill | null>(null);
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [trackedUrlOverrides, setTrackedUrlOverrides] = useState<Set<string>>(() => new Set());
  const [isRefreshing, startRefresh] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const onRefresh = useCallback(() => {
    startRefresh(async () => {
      setActionError(null);
      const result = await refreshFeed();
      if (result?.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }, [router]);

  const [dismissedSet, setDismissedSet] = useState<Set<string>>(() => new Set(dismissedIds));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissedSet(new Set(dismissedIds));
  }, [dismissedIds]);

  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set(savedIds));
  const [savedOverrides, setSavedOverrides] = useState<Map<string, FeedPosting>>(() => new Map());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedSet(new Set(savedIds));
  }, [savedIds]);

  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [pendingSavedIds, setPendingSavedIds] = useState<Set<string>>(() => new Set());

  const onToggleDismiss = useCallback((posting: FeedPosting, next: boolean) => {
    const id = posting.id;
    setActionError(null);
    setDismissedSet((prev) => applyInteractionIds(prev, posting.interactionIds, next));
    setPendingIds((prev) => {
      const out = new Set(prev);
      out.add(id);
      return out;
    });
    (async () => {
      const result = next
        ? await dismissPosting(posting.interactionIds)
        : await undismissPosting(posting.interactionIds);
      if (result?.error) {
        setActionError(result.error);
        setDismissedSet((prev) => applyInteractionIds(prev, posting.interactionIds, !next));
      }
      setPendingIds((prev) => {
        if (!prev.has(id)) return prev;
        const out = new Set(prev);
        out.delete(id);
        return out;
      });
    })();
  }, []);

  const onToggleSaved = useCallback((posting: FeedPosting, next: boolean) => {
    const id = posting.id;
    setActionError(null);
    setSavedSet((prev) => applyInteractionIds(prev, posting.interactionIds, next));
    if (next) {
      setSavedOverrides((prev) => {
        const out = new Map(prev);
        out.set(id, posting);
        return out;
      });
    }
    setPendingSavedIds((prev) => {
      const out = new Set(prev);
      out.add(id);
      return out;
    });
    (async () => {
      const result = next
        ? await savePosting(posting.interactionIds)
        : await unsavePosting(posting.interactionIds);
      if (result?.error) {
        setActionError(result.error);
        setSavedSet((prev) => applyInteractionIds(prev, posting.interactionIds, !next));
      }
      setPendingSavedIds((prev) => {
        if (!prev.has(id)) return prev;
        const out = new Set(prev);
        out.delete(id);
        return out;
      });
    })();
  }, []);

  const trackedIdSet = useMemo(() => {
    const urls = new Set([...trackedUrls, ...trackedUrlOverrides]);
    const ids = new Set<string>();
    const rows = new Map<string, FeedPosting>();
    for (const p of newPostings) rows.set(p.id, p);
    for (const p of savedPostings) rows.set(p.id, p);
    for (const p of savedOverrides.values()) rows.set(p.id, p);
    for (const alert of briefing.starredPostings) rows.set(alert.posting.id, alert.posting);
    for (const p of rows.values()) {
      const key = normalizeUrl(p.url) ?? p.url;
      if (urls.has(key)) ids.add(p.id);
    }
    return ids;
  }, [briefing.starredPostings, newPostings, savedOverrides, savedPostings, trackedUrls, trackedUrlOverrides]);

  const availableNew = useMemo(
    () =>
      newPostings.filter(
        (posting) =>
          !hasAnyInteraction(dismissedSet, posting.interactionIds) && !trackedIdSet.has(posting.id),
      ),
    [dismissedSet, newPostings, trackedIdSet],
  );
  const visibleNew = useMemo(() => availableNew.slice(0, HOME_MAX_NEW_ROWS), [availableNew]);
  const hiddenNewCount = Math.max(0, availableNew.length - visibleNew.length);
  const visibleSaved = useMemo(() => {
    const byId = new Map<string, FeedPosting>();
    for (const posting of savedPostings) byId.set(posting.id, posting);
    for (const posting of savedOverrides.values()) byId.set(posting.id, posting);

    const rows: FeedPosting[] = [];
    for (const posting of byId.values()) {
      if (
        hasAnyInteraction(savedSet, posting.interactionIds) &&
        !hasAnyInteraction(dismissedSet, posting.interactionIds)
      ) {
        rows.push(posting);
      }
    }
    return rows.slice(0, HOME_MAX_SAVED_ROWS);
  }, [dismissedSet, savedOverrides, savedPostings, savedSet]);

  const onApplicationCreated = useCallback((application: { postingUrl: string | null }) => {
    const normalized = normalizeUrl(application.postingUrl);
    if (!normalized) return;
    setTrackedUrlOverrides((prev) => {
      const next = new Set(prev);
      next.add(normalized);
      return next;
    });
  }, []);

  const openTrack = useCallback(
    async (posting: FeedPosting) => {
      if (quickTrackEnabled) {
        setTrackPendingId(posting.id);
        setActionError(null);
        const result = await createApplication(buildTrackApplicationFormData(posting));
        setTrackPendingId(null);
        if ("error" in result) {
          setActionError(result.error ?? "Unable to add application.");
          return;
        }
        onApplicationCreated({ postingUrl: posting.url });
        router.refresh();
        return;
      }

      const applicationSeason = feedSeasonToApplicationSeason(posting.season);
      setDialogPrefill({
        company: posting.company,
        role: posting.title,
        posting_url: posting.url,
        location: posting.locations.join(" · "),
        ...(applicationSeason ? { season: applicationSeason } : {}),
      });
    },
    [quickTrackEnabled, onApplicationCreated, router],
  );

  const postingList = (postings: FeedPosting[], isNew: boolean) => (
    <motion.ul variants={motionVariants.list} initial={false} animate="visible" className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {postings.map((posting) => (
          <PostingRow
            key={posting.id}
            density="comfortable"
            posting={posting}
            dismissed={hasAnyInteraction(dismissedSet, posting.interactionIds)}
            saved={hasAnyInteraction(savedSet, posting.interactionIds)}
            tracked={trackedIdSet.has(posting.id)}
            isNew={isNew}
            pending={pendingIds.has(posting.id)}
            savePending={pendingSavedIds.has(posting.id)}
            trackPending={trackPendingId === posting.id}
            onTrack={openTrack}
            onToggleSaved={onToggleSaved}
            onToggleDismiss={onToggleDismiss}
          />
        ))}
      </AnimatePresence>
    </motion.ul>
  );

  const starredList = (alerts: StarredPostingAlert[]) => (
    <motion.ul variants={motionVariants.list} initial={false} animate="visible" className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {alerts.map(({ posting, isNew }) => (
          <PostingRow
            key={posting.id}
            density="comfortable"
            posting={posting}
            dismissed={hasAnyInteraction(dismissedSet, posting.interactionIds)}
            saved={hasAnyInteraction(savedSet, posting.interactionIds)}
            tracked={trackedIdSet.has(posting.id)}
            isNew={isNew}
            pending={pendingIds.has(posting.id)}
            savePending={pendingSavedIds.has(posting.id)}
            trackPending={trackPendingId === posting.id}
            onTrack={openTrack}
            onToggleSaved={onToggleSaved}
            onToggleDismiss={onToggleDismiss}
          />
        ))}
      </AnimatePresence>
    </motion.ul>
  );

  return (
    <PageShell>
      <PageMain width="xl">
        <PageHeader
          title={getPageLabel("/home")}
          actions={
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh feed"
              className="group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] text-muted-foreground transition-colors duration-150 hover:border-rule-strong hover:text-foreground disabled:cursor-wait disabled:opacity-60"
              style={{ borderColor: "var(--rule)" }}
            >
              <RefreshCw
                size={13}
                strokeWidth={1.75}
                className={isRefreshing ? "animate-spin" : "transition-transform duration-300 group-hover:rotate-180"}
              />
              Refresh feed
            </button>
          }
        />

        {actionError ? (
          <div className="mb-6">
            <InlineError message={actionError} onRetry={() => setActionError(null)} />
          </div>
        ) : null}

        <PageSection rule={false} className="mb-12">
          <SectionHeading title="Snapshot" description="Your application pipeline." />
          <HomeSnapshot applications={applications} />
        </PageSection>

        <PageSection rule={false} className="mb-12">
          <SectionHeading
            title="Since yesterday"
            description="Roles posted in the last 24 hours."
          />
          {visibleNew.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Nothing new since yesterday.</p>
          ) : (
            <>
              {postingList(visibleNew, true)}
              {hiddenNewCount > 0 ? (
                <Link
                  href="/live"
                  className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {hiddenNewCount} more in Openings <ArrowRight size={14} strokeWidth={1.75} />
                </Link>
              ) : null}
            </>
          )}
        </PageSection>

        <PageSection rule={false} className="mb-12">
          <SectionHeading
            title="Starred"
            description="Open roles at companies you've starred."
          />
          {starredCompanyCount === 0 ? (
            <>
              <p className="text-[15px] text-muted-foreground">
                Star companies to track their open roles here.
              </p>
              <Link
                href="/discover"
                className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Browse companies <ArrowRight size={14} strokeWidth={1.75} />
              </Link>
            </>
          ) : briefing.starredPostings.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">
              No open roles at your {starredCompanyCount}{" "}
              {starredCompanyCount === 1 ? "starred company" : "starred companies"} right now.
            </p>
          ) : (
            starredList(briefing.starredPostings)
          )}
        </PageSection>

        <PageSection rule={false} className="mb-12">
          <SectionHeading title="For later" description="Postings you've saved from Openings." />
          {visibleSaved.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Saved postings will collect here.</p>
          ) : (
            postingList(visibleSaved, false)
          )}
        </PageSection>
      </PageMain>

      <ApplicationDialog
        open={dialogPrefill !== null}
        onClose={() => setDialogPrefill(null)}
        initialValues={dialogPrefill ?? undefined}
        onCreated={onApplicationCreated}
      />
    </PageShell>
  );
}
