"use client";

import { memo, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Bookmark, Check, Plus, RotateCcw, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { CompanyLogo } from "@/components/company-logo";
import { SeasonPill } from "@/components/season-pill";
import { motionVariants } from "@/lib/ui/motion";
import { safeExternalHref } from "@/lib/url";
import type { FeedPosting } from "@/lib/feed/source";

interface RowProps {
  posting: FeedPosting;
  dismissed: boolean;
  saved: boolean;
  tracked: boolean;
  isNew: boolean;
  pending?: boolean;
  savePending?: boolean;
  onTrack: (posting: FeedPosting) => void;
  onToggleSaved: (posting: FeedPosting, next: boolean) => void;
  onToggleDismiss: (posting: FeedPosting, next: boolean) => void;
}

export const PostingRow = memo(function PostingRow({
  posting,
  dismissed,
  saved,
  tracked,
  isNew,
  pending,
  savePending,
  onTrack,
  onToggleSaved,
  onToggleDismiss,
}: RowProps) {
  const posted = useMemo(() => {
    if (!posting.datePosted) return "";
    try {
      return formatDistanceToNowStrict(new Date(posting.datePosted * 1000), { addSuffix: true })
        .replace("about ", "");
    } catch {
      return "";
    }
  }, [posting.datePosted]);

  const locationLabel = useMemo(() => formatLocations(posting.locations), [posting.locations]);
  const postingHref = useMemo(() => safeExternalHref(posting.url), [posting.url]);

  const handleTrack = useCallback(() => onTrack(posting), [onTrack, posting]);
  const handleSave = useCallback(
    () => onToggleSaved(posting, !saved),
    [onToggleSaved, posting, saved],
  );
  const handleToggle = useCallback(
    () => onToggleDismiss(posting, !dismissed),
    [onToggleDismiss, posting, dismissed],
  );

  return (
    <motion.li
      layout
      variants={motionVariants.row}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={{ x: 2 }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 34, mass: 0.7 } }}
      className={`group transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)] ${
        dismissed ? "saturate-50" : ""
      }`}
    >
      <div style={dismissed ? { opacity: 0.5 } : undefined} className="flex items-center gap-5 px-2 py-4">
        <CompanyLogo company={posting.company} size={30} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
            <span className="truncate font-medium text-foreground/80">{posting.company}</span>
            <SeasonPill season={posting.season} />
            {isNew && !tracked && (
              <span
                className="inline-flex items-center font-mono text-[9px] font-medium uppercase tracking-[0.16em]"
                style={{ color: "var(--primary)" }}
              >
                · New
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {postingHref ? (
              <a
                href={postingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-[14px] font-medium text-foreground tracking-tight hover:underline underline-offset-4 decoration-muted-foreground/40"
              >
                {posting.title}
              </a>
            ) : (
              <span className="truncate text-[14px] font-medium text-foreground tracking-tight">
                {posting.title}
              </span>
            )}
          </div>
        </div>

        <div className="hidden md:block min-w-0 w-48 shrink-0 text-[12px] text-muted-foreground truncate">
          {locationLabel}
        </div>

        <div className="w-24 shrink-0 text-right label-meta tabular whitespace-nowrap">
          {posted}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {tracked ? (
            <span
              aria-label="Tracked"
              title="Already in your pipeline"
              className="inline-flex size-7 items-center justify-center rounded-full"
              style={{
                color: "var(--primary)",
                background: "color-mix(in oklab, var(--primary) 10%, transparent)",
              }}
            >
              <Check size={13} strokeWidth={2.5} />
            </span>
          ) : (
            <IconButton label="Track" onClick={handleTrack} tone="positive">
              <Plus size={14} strokeWidth={1.85} />
            </IconButton>
          )}
          <IconButton
            label={saved ? "Unsave" : "Save for later"}
            onClick={handleSave}
            disabled={savePending}
            tone={saved ? "saved" : "neutral"}
          >
            <Bookmark
              size={14}
              strokeWidth={1.85}
              fill={saved ? "currentColor" : "none"}
            />
          </IconButton>
          <IconButton
            label={dismissed ? "Restore" : "Dismiss"}
            onClick={handleToggle}
            disabled={pending}
            tone={dismissed ? "neutral" : "negative"}
          >
            {dismissed ? <RotateCcw size={14} strokeWidth={1.85} /> : <X size={14} strokeWidth={1.85} />}
          </IconButton>
        </div>
      </div>
    </motion.li>
  );
});

type IconButtonTone = "positive" | "negative" | "neutral" | "saved";

const TONE_CLASSES: Record<IconButtonTone, string> = {
  positive:
    "text-muted-foreground/60 hover:text-[color:var(--primary)] hover:bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]",
  negative:
    "text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10",
  neutral:
    "text-muted-foreground/60 hover:text-foreground hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]",
  saved:
    "text-[color:var(--primary)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] hover:bg-[color-mix(in_oklab,var(--primary)_14%,transparent)]",
};

function IconButton({
  children,
  label,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: IconButtonTone;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.08 }}
      className={`inline-flex size-7 items-center justify-center rounded-full leading-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:block [&>svg]:shrink-0 ${TONE_CLASSES[tone]}`}
    >
      {children}
    </motion.button>
  );
}

function formatLocations(locations: string[]): string {
  if (locations.length === 0) return "—";
  if (locations.length <= 2) return locations.join(" · ");
  return `${locations.slice(0, 2).join(" · ")} +${locations.length - 2}`;
}
