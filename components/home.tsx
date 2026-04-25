"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, RefreshCw } from "lucide-react";
import { ApplicationDialog } from "@/components/application-dialog";
import { PostingRow } from "@/components/posting-row";
import { StatusDot } from "@/components/status-badge";
import { InlineError } from "@/components/ui/inline-error";
import { motionVariants } from "@/lib/ui/motion";
import { normalizeUrl } from "@/lib/url";
import { STATUSES, STATUS_LABELS } from "@/lib/config/events";
import { dismissPosting, refreshFeed, undismissPosting } from "@/lib/actions/feed";
import type { FeedPosting, FeedSeason } from "@/lib/feed/source";
import type { Status } from "@/types/application";

const MAX_NEW_ROWS = 20;

interface Props {
  statusCounts: Record<Status, number>;
  totalApplications: number;
  newPostings: FeedPosting[];
  dismissedIds: string[];
  trackedUrls: string[];
}

interface Prefill {
  company: string;
  role: string;
  posting_url: string;
  location: string;
  season: FeedSeason;
}

export function Home({
  statusCounts,
  totalApplications,
  newPostings,
  dismissedIds,
  trackedUrls,
}: Props) {
  const router = useRouter();
  const [dialogPrefill, setDialogPrefill] = useState<Prefill | null>(null);
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

  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const onToggleDismiss = useCallback(
    (posting: FeedPosting, next: boolean) => {
      const id = posting.id;
      setActionError(null);
      setDismissedSet((prev) => {
        const out = new Set(prev);
        if (next) out.add(id);
        else out.delete(id);
        return out;
      });
      setPendingIds((prev) => {
        const out = new Set(prev);
        out.add(id);
        return out;
      });
      (async () => {
        const result = next ? await dismissPosting(id) : await undismissPosting(id);
        if (result?.error) {
          setActionError(result.error);
          setDismissedSet((prev) => {
            const out = new Set(prev);
            if (next) out.delete(id);
            else out.add(id);
            return out;
          });
        }
        setPendingIds((prev) => {
          if (!prev.has(id)) return prev;
          const out = new Set(prev);
          out.delete(id);
          return out;
        });
      })();
    },
    [],
  );

  const trackedIdSet = useMemo(() => {
    const urls = new Set([...trackedUrls, ...trackedUrlOverrides]);
    const ids = new Set<string>();
    for (const p of newPostings) {
      const key = normalizeUrl(p.url) ?? p.url;
      if (urls.has(key)) ids.add(p.id);
    }
    return ids;
  }, [newPostings, trackedUrls, trackedUrlOverrides]);

  const visibleNew = useMemo(
    () => newPostings.slice(0, MAX_NEW_ROWS),
    [newPostings],
  );

  const openTrack = useCallback((posting: FeedPosting) => {
    setDialogPrefill({
      company: posting.company,
      role: posting.title,
      posting_url: posting.url,
      location: posting.locations.join(" · "),
      season: posting.season,
    });
  }, []);

  const onApplicationCreated = useCallback((application: { postingUrl: string | null }) => {
    const normalized = normalizeUrl(application.postingUrl);
    if (!normalized) return;
    setTrackedUrlOverrides((prev) => {
      const next = new Set(prev);
      next.add(normalized);
      return next;
    });
  }, []);

  const today = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 pt-24 sm:pt-28 lg:pt-32 pb-24">
        <motion.header
          className="masthead mb-14 sm:mb-18"
          variants={motionVariants.riseIn}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-baseline justify-between pb-4">
            <span className="label-micro">Launchpad / Overview</span>
            <span className="label-meta hidden sm:inline">{today}</span>
          </div>
          <span className="rule-strong" />
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="display-serif text-[4.5rem] sm:text-[5.75rem] lg:text-[6.5rem] text-foreground">
                Home
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                {totalApplications === 0
                  ? "A quiet place for a loud search. Begin when you're ready — the feed below is already listening."
                  : `You're tracking ${totalApplications} application${totalApplications === 1 ? "" : "s"}. A fresh run of openings is below, gathered since yesterday.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh feed"
              className="group inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground hover:border-rule-strong disabled:opacity-60 disabled:cursor-wait"
              style={{ borderColor: "var(--rule)" }}
            >
              <RefreshCw size={13} strokeWidth={1.75} className={isRefreshing ? "animate-spin" : "transition-transform duration-300 group-hover:rotate-180"} />
              Refresh feed
            </button>
          </div>
        </motion.header>

        {actionError && (
          <div className="mb-10">
            <InlineError message={actionError} onRetry={() => setActionError(null)} />
          </div>
        )}

        <motion.section
          className="mb-20"
          variants={motionVariants.fadeIn}
          initial="hidden"
          animate="visible"
        >
          <div className="mb-6 flex items-baseline justify-between">
            <div className="flex items-baseline gap-3">
              <span className="label-micro">01 / Pipeline</span>
              <h2 className="display-serif text-[22px] text-foreground">
                Funnel
              </h2>
            </div>
            <Link
              href="/applications"
              className="label-meta link-edit hover:text-foreground"
            >
              View all <ArrowRight size={11} strokeWidth={1.75} />
            </Link>
          </div>
          <span className="rule mb-0" />

          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0" style={{ borderColor: "var(--rule)" }}>
            {STATUSES.map((status) => {
              const count = statusCounts[status];
              return (
                <Link
                  key={status}
                  href={`/applications?status=${status}`}
                  className="group relative p-6 transition-colors duration-200 hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)]"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    <StatusDot status={status} size={6} />
                    <span className="figure-label">{STATUS_LABELS[status]}</span>
                  </div>
                  <div className="figure-number">{count}</div>
                  <ArrowRight
                    size={14}
                    strokeWidth={1.5}
                    className="absolute top-6 right-6 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground group-hover:translate-x-0.5"
                  />
                </Link>
              );
            })}
          </div>
          <span className="rule" />
        </motion.section>

        <motion.section
          variants={motionVariants.fadeIn}
          initial="hidden"
          animate="visible"
        >
          <div className="mb-6 flex items-baseline justify-between">
            <div className="flex items-baseline gap-3">
              <span className="label-micro">02 / New</span>
              <h2 className="display-serif text-[22px] text-foreground">
                Since yesterday
                {visibleNew.length > 0 && (
                  <span className="ml-2 font-mono text-[13px] font-normal tracking-normal text-muted-foreground">
                    {visibleNew.length}
                  </span>
                )}
              </h2>
            </div>
            <Link
              href="/discover"
              className="label-meta link-edit hover:text-foreground"
            >
              All listings <ArrowRight size={11} strokeWidth={1.75} />
            </Link>
          </div>
          <span className="rule" />

          {visibleNew.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[15px] text-muted-foreground">
                Nothing new since yesterday.
              </p>
              <Link
                href="/discover"
                className="mt-4 inline-flex items-center gap-1 text-[13px] text-foreground hover:text-muted-foreground transition-colors duration-150"
              >
                Browse the archive <ArrowRight size={13} strokeWidth={1.75} />
              </Link>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--rule)" }}>
              {visibleNew.map((posting) => (
                <PostingRow
                  key={posting.id}
                  posting={posting}
                  dismissed={dismissedSet.has(posting.id)}
                  tracked={trackedIdSet.has(posting.id)}
                  isNew
                  pending={pendingIds.has(posting.id)}
                  onTrack={openTrack}
                  onToggleDismiss={onToggleDismiss}
                />
              ))}
            </ul>
          )}
        </motion.section>
      </main>

      <ApplicationDialog
        open={dialogPrefill !== null}
        onClose={() => setDialogPrefill(null)}
        initialValues={dialogPrefill ?? undefined}
        onCreated={onApplicationCreated}
      />
    </div>
  );
}
