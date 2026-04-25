"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Application, APPLICATION_SEASONS, ApplicationEvent, ApplicationSeason, EventType, Status } from "@/types/application";
import { ADDABLE_EVENT_TYPES, EVENT_CONFIG } from "@/lib/config/events";
import { createEvent, deleteEvent, updateEventDate, updateEventNotes } from "@/lib/actions/events";
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
import { motionVariants } from "@/lib/ui/motion";
import { displayUrl, normalizeUrl, safeExternalHref } from "@/lib/url";
import { CalendarDays, Check, Link as LinkIcon, X } from "lucide-react";

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
): ApplicationEvent {
  return {
    id: `temp-${crypto.randomUUID()}`,
    application_id: application.id,
    event_type: eventType,
    event_date: eventDate,
    notes: notes.trim() || null,
    round_number: eventType === "interview" ? getNextInterviewRound(application.events) : null,
    created_at: new Date().toISOString(),
  };
}

export function ApplicationDetail({ application, onClose }: Props) {
  // Form state for the "Add event" panel. Reset whenever the user opens a
  // different application so values from the previous detail don't leak in.
  const [eventType, setEventType] = useState<EventType>("oa");
  const [eventDate, setEventDate] = useState<string>(todayISO);
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
    if (result?.error) {
      setOptimisticApplication(previous);
      setError(result.error);
      finishSync(result.error);
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
    const tempEvent = buildTempEvent(previous, eventType, eventDate, notes);
    setOptimisticApplication(addEvent(previous, tempEvent));

    const result = await createEvent(previous.id, eventType, eventDate, notes);
    if (result?.error) {
      setOptimisticApplication(previous);
      setError(result.error);
      finishSync(result.error);
    } else {
      setOptimisticApplication((current) => {
        if (!current || !result.event) return current;
        const reconciled = replaceEvent(current, tempEvent.id, result.event);
        return result.status ? { ...reconciled, status: result.status } : reconciled;
      });
      setNotes("");
      setEventDate(todayISO());
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
    if (result?.error) {
      setOptimisticApplication(previous);
      finishSync(result.error);
      return result.error;
    }

    setOptimisticApplication((current) => {
      if (!current || !result?.status) return current;
      return { ...current, status: result.status as Status };
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
    if (result?.error) {
      setOptimisticApplication(previous);
      finishSync(result.error);
      return result.error;
    }

    setOptimisticApplication((current) => {
      if (!current || !result.event) return current;
      return replaceEvent(current, event.id, result.event);
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
    if (result?.error) {
      setOptimisticApplication(previous);
      finishSync(result.error);
      return result.error;
    }

    setOptimisticApplication((current) => {
      if (!current || !result.event) return current;
      return replaceEvent(current, event.id, result.event);
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
        <div
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
            className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_55%,transparent)]"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            variants={motionVariants.gentleScale}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative z-10 flex h-[min(85vh,840px)] min-h-[480px] w-full max-w-3xl flex-col overflow-hidden rounded-md border bg-card"
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
                notes={notes}
                addingEvent={addingEvent}
                error={error}
                onEventTypeChange={setEventType}
                onEventDateChange={setEventDate}
                onNotesChange={setNotes}
                onSubmitEvent={handleAddEvent}
                onClearError={() => setError(null)}
                onSaveField={commitApplicationFields}
              />
            </div>
          </motion.div>
        </div>
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
                className="display-serif text-[30px] font-normal tracking-tight text-foreground"
              />
              <InlineEdit
                value={application.role}
                onSave={(v) => onSaveField({ role: v })}
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
  notes,
  addingEvent,
  error,
  onEventTypeChange,
  onEventDateChange,
  onNotesChange,
  onSubmitEvent,
  onClearError,
  onSaveField,
}: {
  application: Application;
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
      <div className="space-y-8 px-6 py-7">
        <section>
          <div className="mb-4 flex items-baseline gap-3">
            <span className="label-micro">Details</span>
            <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
          </div>
          <div className="divide-y" style={{ borderColor: "var(--rule)" }}>
            <DetailRow label="Posting">
              <PostingUrlField
                value={application.posting_url}
                onSave={(url) => onSaveField({ posting_url: url })}
              />
            </DetailRow>
            <DetailRow label="Location">
              <LocationField
                value={application.location}
                onSave={(loc) => onSaveField({ location: loc })}
              />
            </DetailRow>
            <DetailRow label="Season">
              <SeasonField
                value={application.season}
                onSave={(season) => onSaveField({ season })}
              />
            </DetailRow>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline gap-3">
            <span className="label-micro">Add event</span>
            <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
          </div>
          <form
            onSubmit={onSubmitEvent}
            className="space-y-4"
          >
            <EventTypePicker value={eventType} onChange={onEventTypeChange} />
            <EventDateField value={eventDate} onChange={onEventDateChange} />

            <label className="block space-y-1.5">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Notes <span className="normal-case tracking-normal text-muted-foreground/45">(optional)</span>
              </span>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Add interview round details, recruiter notes, or next steps..."
                rows={4}
                className="min-h-24 w-full resize-none rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/45 focus:border-foreground/30 focus:bg-background"
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
              className="h-10 w-full rounded-xl text-xs font-medium uppercase tracking-wider"
            />
          </form>
        </section>
      </div>
    </aside>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="label-micro">{label}</span>
      <div className="min-w-0">{children}</div>
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
          transition={{ duration: 0.18, ease: "easeOut" }}
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
      <div className="grid grid-cols-2 gap-2">
        {ADDABLE_EVENT_TYPES.map((type) => {
          const active = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 ${
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
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const selected = value ? parseISO(value) : undefined;

  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Date</span>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <CalendarDays className="size-3" />
          {selected ? format(selected, "MMM d, yyyy") : "—"}
        </span>
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-border/70 bg-background/80 px-2.5 text-sm text-foreground outline-none transition-colors duration-150 focus:border-foreground/30 focus:bg-background"
      />
    </label>
  );
}
