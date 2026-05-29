"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { InlineError } from "@/components/ui/inline-error";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { transitions } from "@/lib/ui/motion";

export type EventEditingState = {
  id: string;
  date: string;
  notes: string;
};

const TIMELINE_TEXT_INPUT_CLASS =
  "date-input h-8 w-auto rounded-md border border-border/70 bg-background/80 px-2 text-xs outline-none transition-[border-color,background-color,box-shadow,opacity] duration-200 focus:border-foreground/30 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)] disabled:opacity-60";
const TIMELINE_TEXTAREA_CLASS =
  "min-h-9 w-full resize-y rounded-md border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs leading-relaxed text-foreground outline-none transition-[border-color,background-color,box-shadow,opacity] duration-200 placeholder:text-muted-foreground/45 focus:border-foreground/30 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)] disabled:opacity-60";
const TIMELINE_CANCEL_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] uppercase tracking-wider text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-50";
const TIMELINE_SAVE_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[10px] font-medium uppercase tracking-wider text-primary-foreground transition-colors duration-150 hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60";

export function EventEditForm({
  editing,
  pending,
  errorMessage,
  onDateChange,
  onNotesChange,
  onCancel,
  onClearError,
  onSave,
}: {
  editing: EventEditingState;
  pending: boolean;
  errorMessage: string | null;
  onDateChange: (date: string) => void;
  onNotesChange: (notes: string) => void;
  onCancel: () => void;
  onClearError: () => void;
  onSave: () => void;
}) {
  return (
    <motion.div
      key="editor"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transitions.timelineFade}
      className="space-y-2"
    >
      <div className="mt-1">
        <input
          type="date"
          value={editing.date}
          disabled={pending}
          onChange={(changeEvent) => onDateChange(changeEvent.target.value)}
          className={TIMELINE_TEXT_INPUT_CLASS}
        />
      </div>
      <textarea
        value={editing.notes}
        disabled={pending}
        autoFocus
        onChange={(changeEvent) => onNotesChange(changeEvent.target.value)}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === "Escape") onCancel();
          if (keyEvent.key === "Enter" && (keyEvent.metaKey || keyEvent.ctrlKey)) {
            onSave();
          }
        }}
        placeholder="Add a note..."
        rows={2}
        className={TIMELINE_TEXTAREA_CLASS}
      />
      {errorMessage && <InlineError message={errorMessage} onRetry={onClearError} />}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={TIMELINE_CANCEL_BUTTON_CLASS}
        >
          <X size={13} />
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || !editing.date}
          className={TIMELINE_SAVE_BUTTON_CLASS}
        >
          {pending ? <InlineSpinner /> : <Check size={13} />}
          Save
        </button>
      </div>
    </motion.div>
  );
}
