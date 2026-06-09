"use client";

import { Bookmark, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

function ActionButton({
  children,
  label,
  onClick,
  disabled,
  active,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
        active && "text-[var(--selection-fg)] hover:text-[var(--selection-fg)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Compact row actions for chat posting lists only. */
export function PostingRowActions({
  tracked,
  saved,
  trackPending,
  savePending,
  onTrack,
  onToggleSaved,
  className,
}: {
  tracked: boolean;
  saved: boolean;
  trackPending?: boolean;
  savePending?: boolean;
  onTrack: () => void;
  onToggleSaved: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-0.5", className)}
      role="group"
      aria-label="Posting actions"
      onClick={(event) => event.stopPropagation()}
    >
      {tracked ? (
        <span
          aria-label="Tracked"
          title="Already in your pipeline"
          className="inline-flex size-8 items-center justify-center text-primary"
        >
          <Check size={15} strokeWidth={2.5} />
        </span>
      ) : (
        <ActionButton
          label="Add to applications"
          onClick={onTrack}
          disabled={trackPending}
        >
          <Plus size={16} strokeWidth={2} />
        </ActionButton>
      )}
      <ActionButton
        label={saved ? "Unsave" : "Save for later"}
        onClick={onToggleSaved}
        disabled={savePending}
        active={saved}
      >
        <Bookmark size={15} strokeWidth={1.85} fill={saved ? "currentColor" : "none"} />
      </ActionButton>
    </div>
  );
}
