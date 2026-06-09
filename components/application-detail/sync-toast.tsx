"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { transitions } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

export type SyncState =
  | { status: "idle"; label: null }
  | { status: "pending" | "success" | "error"; label: string };

function SyncToastPill({
  state,
  onDismiss,
}: {
  state: Exclude<SyncState, { status: "idle"; label: null }>;
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex min-h-9 max-w-[min(15rem,calc(100vw-3rem))] items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm",
        state.status === "error"
          ? "border-destructive/25 bg-[color-mix(in_oklab,var(--destructive)_12%,var(--background))] text-destructive"
          : "border-border/70 bg-[color-mix(in_oklab,var(--background)_88%,var(--paper-sunk))] text-muted-foreground",
      )}
      role={state.status === "error" ? "alert" : "status"}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="inline-flex size-3.5 shrink-0 items-center justify-center" aria-hidden>
          {state.status === "pending" && <InlineSpinner />}
          {state.status === "success" && (
            <Check className="size-3.5 text-[color:var(--success)]" />
          )}
        </span>
        <span className="truncate">{state.label}</span>
      </span>
      {state.status === "error" && (
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-destructive/70 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
          aria-label="Dismiss error"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function FloatingSyncToast({
  state,
  onDismiss,
  placement = "floating",
}: {
  state: SyncState;
  onDismiss: () => void;
  placement?: "floating" | "above-footer";
}) {
  if (placement === "above-footer") {
    return (
      <AnimatePresence initial={false} mode="wait">
        {state.status !== "idle" && (
          <motion.div
            key={`${state.status}-${state.label}`}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={transitions.spring}
            className="pointer-events-none absolute inset-x-0 bottom-full z-20 mb-2.5 flex justify-center px-5"
            aria-live="polite"
          >
            <SyncToastPill state={state} onDismiss={onDismiss} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      {state.status !== "idle" && (
        <motion.div
          key={`${state.status}-${state.label}`}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={transitions.spring}
          className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-6 sm:px-8"
          aria-live="polite"
        >
          <SyncToastPill state={state} onDismiss={onDismiss} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
