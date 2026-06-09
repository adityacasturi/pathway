"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EventDateField, EventTypePicker } from "@/components/application-detail/event-form-fields";
import { AsyncButton } from "@/components/ui/async-button";
import { InlineError } from "@/components/ui/inline-error";
import { motionVariants } from "@/lib/ui/motion";
import { EventType } from "@/types/application";

export function AddEventPanel({
  eventType,
  eventDate,
  notes,
  addingEvent,
  error,
  onEventTypeChange,
  onEventDateChange,
  onNotesChange,
  onSubmitEvent,
  onClearError,
}: {
  eventType: EventType;
  eventDate: string;
  notes: string;
  addingEvent: boolean;
  error: string | null;
  onEventTypeChange: (type: EventType) => void;
  onEventDateChange: (date: string) => void;
  onNotesChange: (notes: string) => void;
  onSubmitEvent: (event: React.FormEvent) => void;
  onClearError: () => void;
}) {
  return (
    <form onSubmit={onSubmitEvent} className="space-y-3">
      <EventTypePicker value={eventType} onChange={onEventTypeChange} layout="grid" />

      <EventDateField value={eventDate} onChange={onEventDateChange} />

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-foreground/65">
          Notes <span className="font-normal text-muted-foreground/60">(optional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Context, prep notes, next steps…"
          rows={2}
          className="min-h-[4.5rem] w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/50 focus:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)]"
        />
      </label>

      <AnimatePresence>
        {error ? (
          <motion.div
            variants={motionVariants.fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <InlineError message={error} onRetry={onClearError} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AsyncButton
        type="submit"
        state={addingEvent ? "pending" : "idle"}
        disabled={!eventDate}
        idleLabel="Add event"
        pendingLabel="Adding…"
        className="h-8 w-full text-sm font-medium"
      />
    </form>
  );
}
