"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Application, APPLICATION_SEASONS, ApplicationEvent, ApplicationSeason, EventType, Status } from "@/types/application";
import { ADDABLE_EVENT_TYPES, EVENT_CONFIG } from "@/lib/config/events";
import {
  createEvent,
  deleteEvent,
  updateEventDate,
  updateEventDeadline,
  updateEventDeadlineCompletion,
  updateEventNotes,
} from "@/lib/actions/events";
import { updateApplicationFields } from "@/lib/actions/applications";
import {
  addEvent,
  applyEventPatch,
  getNextInterviewRound,
  normalizeApplicationState,
  removeEvent,
  replaceEvent,
} from "@/lib/config/application-state";
import { CompanyLogo } from "@/components/company-logo";
import { EventDot } from "@/components/status-badge";
import { EventTimeline } from "@/components/event-timeline";
import { AsyncButton } from "@/components/ui/async-button";
import { InlineEdit } from "@/components/ui/inline-edit";
import { InlineError } from "@/components/ui/inline-error";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { Label } from "@/components/ui/label";
import { motionVariants, transitions } from "@/lib/ui/motion";
import { displayUrl, normalizeUrl, safeExternalHref } from "@/lib/url";
import { CalendarDays, CalendarRange, Check, Link as LinkIcon, MapPin, X } from "lucide-react";

function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

interface Props {
  application: Application | null;
  onClose: () => void;
}

type SyncState =
  | { status: "idle"; label: null }
  | { status: "pending" | "success" | "error"; label: string };

/**
 * Builds an optimistic event with a `temp-` id so the UI can render the new
 * event immediately. The id is later swapped out for the real one returned by
 * the server (see {@link replaceEvent}).
 */
function buildTempEvent(
  application: Application,
  eventType: EventType,
  eventDate: string,
  notes: string,
  deadlineDate: string | null,
): ApplicationEvent {
  return {
    id: `temp-${crypto.randomUUID()}`,
    application_id: application.id,
    event_type: eventType,
    event_date: eventDate,
    notes: notes.trim() || null,
    round_number: eventType === "interview" ? getNextInterviewRound(application.events) : null,
    deadline_date: eventType === "oa" ? deadlineDate : null,
    deadline_completed_at: null,
    created_at: new Date().toISOString(),
  };
}

export function ApplicationDetail({ application, onClose }: Props) {
  // Form state for the "Add event" panel. Reset whenever the user opens a
  // different application so values from the previous detail don't leak in.
  const [eventType, setEventType] = useState<EventType>("oa");
  const [eventDate, setEventDate] = useState<string>(todayISO);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [notes, setNotes] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle", label: null });

  // Local mirror of the application that we mutate optimistically. On error
  // we roll back to the previous value; on success we reconcile with the
  // server-returned event.
  const [optimisticApplication, setOptimisticApplication] = useState<Application | null>(application);

  const open = !!application;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // When the parent passes a new application (open / refetch), normalize it
  // and reset the per-application form state.
  useEffect(() => {
    if (!application) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticApplication(normalizeApplicationState(application));
    setEventType("oa");
    setEventDate(todayISO());
    setDeadlineDate("");
    setNotes("");
    setError(null);
    setSyncState({ status: "idle", label: null });
  }, [application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // While the application's events refresh from the server, keep the
  // optimistic mirror in sync without resetting form state.
  useEffect(() => {
    if (!application) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticApplication((current) => {
      if (!current || current.id !== application.id) return current;
      return normalizeApplicationState(application);
    });
  }, [application]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // ESC closes the modal.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function startSync(label: string) {
    setError(null);
    setSyncState({ status: "pending", label });
  }

  function finishSync(errorMessage?: string | null) {
    if (errorMessage) {
      setSyncState({ status: "error", label: errorMessage });
      return;
    }

    setSyncState({ status: "success", label: "Saved" });
    window.setTimeout(() => {
      setSyncState((current) =>
        current.status === "success" ? { status: "idle", label: null } : current,
      );
    }, 1200);
  }

  async function commitApplicationFields(fields: {
    company?: string;
    role?: string;
    posting_url?: string | null;
    location?: string | null;
    season?: ApplicationSeason | null;
  }) {
    if (!optimisticApplication) return;

    const previous = optimisticApplication;
    const next = { ...previous, ...fields };
    setOptimisticApplication(next);

    const fieldLabel = Object.keys(fields)[0]?.replace("_", " ") ?? "changes";
    startSync(`Saving ${fieldLabel}`);
    const result = await updateApplicationFields(previous.id, fields);
    if ("error" in result) {
      const message = result.error ?? "Unable to save changes.";
      setOptimisticApplication(previous);
      setError(message);
      finishSync(message);
      return;
    }
    finishSync();
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!optimisticApplication || addingEvent) return;

    setAddingEvent(true);
    startSync("Adding event");

    const previous = optimisticApplication;
    const cleanedDeadlineDate = eventType === "oa" && deadlineDate ? deadlineDate : null;
    const tempEvent = buildTempEvent(previous, eventType, eventDate, notes, cleanedDeadlineDate);
    setOptimisticApplication(addEvent(previous, tempEvent));

    const result = await createEvent(previous.id, eventType, eventDate, notes, cleanedDeadlineDate);
    if ("error" in result) {
      const message = result.error ?? "Unable to add event.";
      setOptimisticApplication(previous);
      setError(message);
      finishSync(message);
    } else {
      const insertedEvent = result.event;
      const nextStatus = result.status;
      setOptimisticApplication((current) => {
        if (!current || !insertedEvent) return current;
        const reconciled = replaceEvent(current, tempEvent.id, insertedEvent);
        return nextStatus ? { ...reconciled, status: nextStatus } : reconciled;
      });
      setNotes("");
      setEventDate(todayISO());
      setDeadlineDate("");
      finishSync();
    }
    setAddingEvent(false);
  }

  async function handleDeleteEvent(event: ApplicationEvent): Promise<string | null> {
    if (!optimisticApplication) return "Application not loaded";

    const previous = optimisticApplication;
    startSync("Deleting event");
    setOptimisticApplication(removeEvent(previous, event.id));

    const result = await deleteEvent(event.id, previous.id);
    if ("error" in result) {
      const message = result.error ?? "Unable to delete event.";
      setOptimisticApplication(previous);
      finishSync(message);
      return message;
    }

    const nextStatus = result.status;
    setOptimisticApplication((current) => {
      if (!current || !nextStatus) return current;
      return { ...current, status: nextStatus as Status };
    });
    finishSync();
    return null;
  }

  async function handleUpdateEventDate(event: ApplicationEvent, newDate: string): Promise<string | null> {
    if (!optimisticApplication) return "Application not loaded";

    const previous = optimisticApplication;
    startSync("Saving event date");
    setOptimisticApplication(applyEventPatch(previous, event.id, { event_date: newDate }));

    const result = await updateEventDate(event.id, previous.id, newDate);
    if ("error" in result) {
      const message = result.error ?? "Unable to save event date.";
      setOptimisticApplication(previous);
      finishSync(message);
      return message;
    }

    const updatedEvent = result.event;
    setOptimisticApplication((current) => {
      if (!current || !updatedEvent) return current;
      return replaceEvent(current, event.id, updatedEvent);
    });
    finishSync();
    return null;
  }

  async function handleUpdateEventNotes(event: ApplicationEvent, nextNotes: string): Promise<string | null> {
    if (!optimisticApplication) return "Application not loaded";

    const previous = optimisticApplication;
    startSync("Saving event notes");
    setOptimisticApplication(applyEventPatch(previous, event.id, { notes: nextNotes.trim() || null }));

    const result = await updateEventNotes(event.id, nextNotes);
    if ("error" in result) {
      const message = result.error ?? "Unable to save event notes.";
      setOptimisticApplication(previous);
      finishSync(message);
      return message;
    }

    const updatedEvent = result.event;
    setOptimisticApplication((current) => {
      if (!current || !updatedEvent) return current;
      return replaceEvent(current, event.id, updatedEvent);
    });
    finishSync();
    return null;
  }

  async function handleUpdateEventDeadline(event: ApplicationEvent, nextDeadlineDate: string | null): Promise<string | null> {
    if (!optimisticApplication) return "Application not loaded";

    const previous = optimisticApplication;
    startSync(nextDeadlineDate ? "Saving deadline" : "Removing deadline");
    setOptimisticApplication(applyEventPatch(previous, event.id, {
      deadline_date: nextDeadlineDate,
      deadline_completed_at: nextDeadlineDate ? event.deadline_completed_at : null,
    }));

    const result = await updateEventDeadline(event.id, previous.id, nextDeadlineDate);
    if ("error" in result) {
      const message = result.error ?? "Unable to save deadline.";
      setOptimisticApplication(previous);
      finishSync(message);
      return message;
    }

    const updatedEvent = result.event;
    setOptimisticApplication((current) => {
      if (!current || !updatedEvent) return current;
      return replaceEvent(current, event.id, updatedEvent);
    });
    finishSync();
    return null;
  }

  async function handleUpdateEventDeadlineCompletion(event: ApplicationEvent, completed: boolean): Promise<string | null> {
    if (!optimisticApplication) return "Application not loaded";

    const previous = optimisticApplication;
    startSync(completed ? "Completing deadline" : "Reopening deadline");
    setOptimisticApplication(applyEventPatch(previous, event.id, {
      deadline_completed_at: completed ? new Date().toISOString() : null,
    }));

    const result = await updateEventDeadlineCompletion(event.id, previous.id, completed);
    if ("error" in result) {
      const message = result.error ?? "Unable to update deadline.";
      setOptimisticApplication(previous);
      finishSync(message);
      return message;
    }

    const updatedEvent = result.event;
    setOptimisticApplication((current) => {
      if (!current || !updatedEvent) return current;
      return replaceEvent(current, event.id, updatedEvent);
    });
    finishSync();
    return null;
  }

  if (!mounted || !optimisticApplication) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        // Clear the optimistic mirror only after the exit animation finishes
        // so the closing modal still has data to render.
        setOptimisticApplication(null);
      }}
    >
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${optimisticApplication.company} application detail`}
        >
          {/* Backdrop */}
          <motion.div
            variants={motionVariants.fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_52%,transparent)] backdrop-blur-[3px]"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            variants={motionVariants.gentleScale}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transitions.spring}
            className="relative z-10 flex h-[min(85vh,840px)] min-h-[480px] w-full max-w-3xl flex-col overflow-hidden rounded-lg border bg-card shadow-[0_35px_110px_-65px_color-mix(in_oklab,var(--ink)_85%,transparent)]"
            style={{ borderColor: "var(--rule-strong)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <DetailHeader
              application={optimisticApplication}
              displayCompany={application?.company ?? optimisticApplication.company}
              onSaveField={commitApplicationFields}
              onClose={onClose}
            />

            <div className="flex flex-1 min-h-0 flex-col md:flex-row">
              <div
                className="relative flex-1 overflow-y-auto px-6 py-7 md:border-r sm:px-8"
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="mb-6 flex items-baseline gap-3">
                  <span className="label-micro">Timeline</span>
                  <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
                </div>
                <EventTimeline
                  events={optimisticApplication.events}
                  onDeleteEvent={handleDeleteEvent}
                  onUpdateEventDate={handleUpdateEventDate}
                  onUpdateEventNotes={handleUpdateEventNotes}
                  onUpdateEventDeadline={handleUpdateEventDeadline}
                  onUpdateEventDeadlineCompletion={handleUpdateEventDeadlineCompletion}
                />
                <FloatingSyncToast
                  state={syncState}
                  onDismiss={() => setSyncState({ status: "idle", label: null })}
                />
              </div>

              <DetailSidebar
                application={optimisticApplication}
                eventType={eventType}
                eventDate={eventDate}
                deadlineDate={deadlineDate}
                notes={notes}
                addingEvent={addingEvent}
                error={error}
                onEventTypeChange={setEventType}
                onEventDateChange={setEventDate}
                onDeadlineDateChange={setDeadlineDate}
                onNotesChange={setNotes}
                onSubmitEvent={handleAddEvent}
                onClearError={() => setError(null)}
                onSaveField={commitApplicationFields}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DetailHeader({
  application,
  displayCompany,
  onSaveField,
  onClose,
}: {
  application: Application;
  displayCompany: string;
  onSaveField: (fields: {
    company?: string;
    role?: string;
    posting_url?: string | null;
    location?: string | null;
    season?: ApplicationSeason | null;
  }) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="shrink-0 border-b px-6 py-6 sm:px-8 sm:py-7"
      style={{ borderColor: "var(--rule)" }}
    >
      <div className="flex items-start gap-5">
        <CompanyLogo company={displayCompany} size={52} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 flex-1 max-w-xl">
              <InlineEdit
                value={application.company}
                onSave={(v) => onSaveField({ company: v })}
                ariaLabel="Company"
                className="display-serif text-[30px] font-normal text-foreground"
              />
              <InlineEdit
                value={application.role}
                onSave={(v) => onSaveField({ role: v })}
                ariaLabel="Role"
                className="mt-1 text-[14px] text-muted-foreground"
                placeholder="Add role..."
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] hover:text-foreground"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSidebar({
  application,
  eventType,
  eventDate,
  deadlineDate,
  notes,
  addingEvent,
  error,
  onEventTypeChange,
  onEventDateChange,
  onDeadlineDateChange,
  onNotesChange,
  onSubmitEvent,
  onClearError,
  onSaveField,
}: {
  application: Application;
  eventType: EventType;
  eventDate: string;
  deadlineDate: string;
  notes: string;
  addingEvent: boolean;
  error: string | null;
  onEventTypeChange: (type: EventType) => void;
  onEventDateChange: (date: string) => void;
  onDeadlineDateChange: (date: string) => void;
  onNotesChange: (notes: string) => void;
  onSubmitEvent: (event: React.FormEvent) => void;
  onClearError: () => void;
  onSaveField: (fields: {
    posting_url?: string | null;
    location?: string | null;
    season?: ApplicationSeason | null;
  }) => void;
}) {
  return (
    <aside
      className="w-full shrink-0 overflow-y-auto border-t bg-[color-mix(in_oklab,var(--paper-sunk)_70%,var(--paper)_30%)] md:w-[21rem] md:border-t-0"
      style={{ borderColor: "var(--rule)" }}
    >
      <div className="space-y-6 px-5 py-5 sm:px-6">
        <section className="space-y-3">
          <SectionHeading>Details</SectionHeading>
          <div className="space-y-2">
            <DetailItem label="Posting" icon={<LinkIcon className="size-3.5" />}>
              <PostingUrlField
                value={application.posting_url}
                onSave={(url) => onSaveField({ posting_url: url })}
              />
            </DetailItem>
            <DetailItem label="Location" icon={<MapPin className="size-3.5" />}>
              <LocationField
                value={application.location}
                onSave={(loc) => onSaveField({ location: loc })}
              />
            </DetailItem>
            <DetailItem label="Season" icon={<CalendarRange className="size-3.5" />}>
              <SeasonField
                value={application.season}
                onSave={(season) => onSaveField({ season })}
              />
            </DetailItem>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading>Add event</SectionHeading>
          <form
            onSubmit={onSubmitEvent}
            className="space-y-3"
          >
            <EventTypePicker value={eventType} onChange={onEventTypeChange} />
            <div className={eventType === "oa" ? "grid grid-cols-2 gap-2" : undefined}>
              <EventDateField value={eventDate} onChange={onEventDateChange} />
              {eventType === "oa" && (
                <EventDateField
                  label="Deadline"
                  value={deadlineDate}
                  onChange={onDeadlineDateChange}
                  optional
                />
              )}
            </div>

            <label className="block space-y-1.5">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Notes <span className="normal-case tracking-normal text-muted-foreground/45">(optional)</span>
              </span>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Add notes or next steps..."
                rows={3}
                className="min-h-20 w-full resize-none rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/45 focus:border-foreground/30 focus:bg-background"
              />
            </label>

            <AnimatePresence>
              {error && (
                <motion.div
                  variants={motionVariants.fadeIn}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
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
              className="h-9 w-full rounded-lg text-xs font-medium uppercase tracking-wider"
            />
          </form>
        </section>
      </div>
    </aside>
  );
}

function SectionHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h3 className="font-sans text-sm font-medium tracking-normal text-foreground">
      {children}
    </h3>
  );
}

function DetailItem({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-center gap-3 rounded-md px-2 py-1.5">
      <span
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/65"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </div>
  );
}

function FloatingSyncToast({
  state,
  onDismiss,
}: {
  state: SyncState;
  onDismiss: () => void;
}) {
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
          <div
            className={`pointer-events-auto flex min-h-10 max-w-[min(28rem,100%)] items-center justify-between gap-3 rounded-full border px-4 py-2 text-xs shadow-sm backdrop-blur-sm ${
              state.status === "error"
                ? "border-destructive/25 bg-[color-mix(in_oklab,var(--destructive)_12%,var(--background))] text-destructive"
                : "border-border/70 bg-[color-mix(in_oklab,var(--background)_88%,var(--paper-sunk))] text-muted-foreground"
            }`}
            role={state.status === "error" ? "alert" : "status"}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="inline-flex size-3.5 shrink-0 items-center justify-center" aria-hidden>
                {state.status === "pending" && <InlineSpinner />}
                {state.status === "success" && <Check className="size-3.5 text-emerald-500" />}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LocationField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value ?? "");
  }, [value]);

  function save() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed !== (value ?? "")) onSave(trimmed || null);
  }

  if (editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
          placeholder="Add location..."
          className="h-8 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/80 px-2.5 text-xs text-foreground outline-none transition-colors duration-150 focus:border-foreground/30 focus:bg-background"
        />
        <button
          type="button"
          onClick={save}
          className="h-8 rounded-lg px-2 text-[10px] uppercase tracking-wider text-foreground hover:bg-muted"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(value ?? "");
            setEditing(false);
          }}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cancel location edit"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="group/location flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`min-w-0 truncate text-left transition-colors duration-150 hover:text-foreground ${
          value ? "" : "text-muted-foreground/50"
        }`}
      >
        {value || "Add location"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground/45 opacity-0 transition-colors duration-150 hover:text-foreground group-hover/location:opacity-100 focus:opacity-100"
      >
        Edit
      </button>
    </div>
  );
}

/**
 * Pill toggle that mirrors the dashboard season filter. Clicking the active
 * pill clears the season (tri-state) so a "remove" button is unnecessary.
 */
function SeasonField({
  value,
  onSave,
}: {
  value: ApplicationSeason | null;
  onSave: (next: ApplicationSeason | null) => void;
}) {
  return (
    <div
      className="inline-flex items-center border"
      style={{ borderColor: "var(--rule)" }}
    >
      {APPLICATION_SEASONS.map((option, idx) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSave(active ? null : option)}
            aria-pressed={active}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 ${
              idx > 0 ? "border-l" : ""
            } ${
              active
                ? "bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={idx > 0 ? { borderColor: "var(--rule)" } : undefined}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shows the application's posting URL as a clickable host (e.g. "acme.com")
 * with an external-link icon. Clicking the host opens the link in a new tab;
 * an "edit" affordance flips it into a small inline input. When no URL is set,
 * a faint "+ Add posting link" prompt is rendered instead.
 */
function PostingUrlField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  // Re-sync draft when the parent value updates (server reconciliation, etc.).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value ?? "");
  }, [value]);

  function save() {
    const normalized = normalizeUrl(draft);
    setEditing(false);
    if (normalized !== value) onSave(normalized);
  }

  if (editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <LinkIcon className="size-3 text-muted-foreground/60 shrink-0" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
          placeholder="https://..."
          className="h-8 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/80 px-2.5 text-xs text-foreground outline-none transition-colors duration-150 focus:border-foreground/30 focus:bg-background"
        />
        <button
          type="button"
          onClick={save}
          className="h-8 rounded-lg px-2 text-[10px] uppercase tracking-wider text-foreground hover:bg-muted"
        >
          Save
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setEditing(false);
              onSave(null);
            }}
            title="Remove link"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/50 transition-colors duration-150 hover:text-foreground"
      >
        <LinkIcon className="size-3" />
        Add posting link
      </button>
    );
  }
  const safeHref = safeExternalHref(value);

  return (
    <div className="group/link flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
      {safeHref ? (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate hover:text-foreground transition-colors duration-150 min-w-0"
          title={value}
        >
          {displayUrl(value)}
        </a>
      ) : (
        <span className="truncate text-muted-foreground/60 min-w-0" title={value}>
          Invalid posting URL
        </span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground/45 opacity-0 transition-colors duration-150 hover:text-foreground group-hover/link:opacity-100 focus:opacity-100"
      >
        Edit
      </button>
    </div>
  );
}

function EventTypePicker({
  value,
  onChange,
}: {
  value: EventType;
  onChange: (type: EventType) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Type</Label>
      <div className="grid grid-cols-2 gap-1.5">
        {ADDABLE_EVENT_TYPES.map((type) => {
          const active = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-150 ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
              style={
                active
                  ? undefined
                  : { borderColor: "var(--rule)" }
              }
            >
              <EventDot type={type} />
              {EVENT_CONFIG[type].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventDateField({
  label = "Date",
  value,
  onChange,
  optional = false,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
}) {
  const selected = value ? parseISO(value) : undefined;

  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
          {optional && <span className="sr-only"> optional</span>}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground/55" aria-hidden>
          <CalendarDays className="size-3" />
        </span>
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={selected ? format(selected, "MMM d, yyyy") : undefined}
        className="h-9 w-full min-w-0 rounded-lg border border-border/70 bg-background/80 px-2.5 text-xs text-foreground outline-none transition-colors duration-150 focus:border-foreground/30 focus:bg-background"
      />
    </label>
  );
}
