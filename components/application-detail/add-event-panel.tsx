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
    <form onSubmit={onSubmitEvent} className="add-event-panel">
      <EventTypePicker value={eventType} onChange={onEventTypeChange} layout="row" />
      <EventDateField value={eventDate} onChange={onEventDateChange} />
      <label className="block space-y-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Notes <span className="normal-case tracking-normal text-muted-foreground/45">(optional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add notes or next steps..."
          rows={2}
          className="min-h-16 w-full resize-y rounded-md border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/45 focus:border-foreground/30 focus:bg-background"
        />
      </label>
      <AnimatePresence>
        {error && (
          <motion.div variants={motionVariants.fadeIn} initial="hidden" animate="visible" exit="hidden">
            <InlineError message={error} onRetry={onClearError} />
          </motion.div>
        )}
      </AnimatePresence>
      <AsyncButton
        type="submit"
        state={addingEvent ? "pending" : "idle"}
        disabled={!eventDate}
        idleLabel="Add event"
        pendingLabel="Saving event"
        className="h-9 w-full rounded-md text-xs font-medium uppercase tracking-wider"
      />
    </form>
  );
}
