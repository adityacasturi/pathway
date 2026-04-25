"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { ApplicationEvent } from "@/types/application";
import { EVENT_CONFIG, eventLabel } from "@/lib/config/events";
import { OfferDot } from "@/components/status-badge";
import { InlineError } from "@/components/ui/inline-error";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { formatDate } from "@/lib/utils";

interface Props {
  events: ApplicationEvent[];
  onDeleteEvent: (event: ApplicationEvent) => Promise<string | null>;
  onUpdateEventDate: (event: ApplicationEvent, newDate: string) => Promise<string | null>;
  onUpdateEventNotes: (event: ApplicationEvent, notes: string) => Promise<string | null>;
}

type EditingState = {
  id: string;
  date: string;
  notes: string;
} | null;

export function EventTimeline({
  events,
  onDeleteEvent,
  onUpdateEventDate,
  onUpdateEventNotes,
}: Props) {
  const [editing, setEditing] = useState<EditingState>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  if (events.length === 0) {
    return (
      <div
        className="rounded-md border border-dashed px-4 py-8 text-center"
        style={{ borderColor: "var(--rule)" }}
      >
        <p className="label-meta">No timeline events yet.</p>
      </div>
    );
  }

  function startEditing(event: ApplicationEvent) {
    if (event.id.startsWith("temp-")) return;
    setConfirmDeleteId(null);
    setRowError(null);
    setEditing({
      id: event.id,
      date: event.event_date,
      notes: event.notes ?? "",
    });
  }

  function cancelEditing() {
    setEditing(null);
    setRowError(null);
  }

  async function saveEditing(event: ApplicationEvent) {
    if (!editing || editing.id !== event.id || pendingId) return;

    setPendingId(event.id);
    setRowError(null);

    let error: string | null = null;
    if (editing.date !== event.event_date) {
      error = await onUpdateEventDate(event, editing.date);
    }

    const nextNotes = editing.notes.trim();
    const currentNotes = event.notes ?? "";
    if (!error && nextNotes !== currentNotes) {
      error = await onUpdateEventNotes(event, nextNotes);
    }

    if (error) {
      setRowError({ id: event.id, message: error });
    } else {
      setEditing(null);
    }
    setPendingId(null);
  }

  async function confirmDelete(event: ApplicationEvent) {
    if (pendingId) return;
    setPendingId(event.id);
    setRowError(null);
    const error = await onDeleteEvent(event);
    if (error) {
      setRowError({ id: event.id, message: error });
    } else {
      setConfirmDeleteId(null);
      if (editing?.id === event.id) setEditing(null);
    }
    setPendingId(null);
  }

  return (
    <ol className="relative space-y-0">
      {events.map((event, index) => {
        const { color } = EVENT_CONFIG[event.event_type];
        const isLast = index === events.length - 1;
        const isEditing = editing?.id === event.id;
        const isPending = pendingId === event.id || event.id.startsWith("temp-");
        const canDelete = event.event_type !== "applied" && !event.id.startsWith("temp-");

        return (
          <motion.li
            key={event.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-[20px_1fr] gap-4"
          >
            <div className="flex flex-col items-center" aria-hidden>
              <div className="mt-1 shrink-0">
                {event.event_type === "offer" ? (
                  <OfferDot size={10} halo />
                ) : (
                  <span
                    className="block rounded-full"
                    style={{
                      width: 10,
                      height: 10,
                      background: color,
                      boxShadow: `0 0 0 3px ${color}22`,
                    }}
                  />
                )}
              </div>
              {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
            </div>

            <div className={isLast ? "pb-0" : "pb-5"}>
              <div
                className="rounded-md border bg-card px-3.5 py-3"
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight text-foreground">
                      {eventLabel(event)}
                    </p>
                    {!isEditing && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(event.event_date)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isPending && (
                      <span
                        className="inline-flex size-8 items-center justify-center text-muted-foreground"
                        title="Syncing"
                      >
                        <InlineSpinner />
                      </span>
                    )}
                    {!isEditing && !event.id.startsWith("temp-") && (
                      <IconButton label="Edit event" onClick={() => startEditing(event)}>
                        <Pencil size={14} />
                      </IconButton>
                    )}
                    {canDelete && !isEditing && (
                      <IconButton
                        label="Delete event"
                        tone="danger"
                        onClick={() => {
                          setRowError(null);
                          setConfirmDeleteId(event.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    )}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div
                      key="editor"
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.12 }}
                      className="mt-3 space-y-3"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
                        <label className="space-y-1.5">
                          <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                            Date
                          </span>
                          <input
                            type="date"
                            value={editing.date}
                            disabled={isPending}
                            onChange={(e) =>
                              setEditing((current) =>
                                current?.id === event.id
                                  ? { ...current, date: e.target.value }
                                  : current,
                              )
                            }
                            className="h-9 w-full rounded-lg border border-border/70 bg-background/80 px-2.5 text-xs text-foreground outline-none transition-colors duration-150 focus:border-foreground/30 disabled:opacity-60"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                            Notes
                          </span>
                          <textarea
                            value={editing.notes}
                            disabled={isPending}
                            onChange={(e) =>
                              setEditing((current) =>
                                current?.id === event.id
                                  ? { ...current, notes: e.target.value }
                                  : current,
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") cancelEditing();
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                void saveEditing(event);
                              }
                            }}
                            placeholder="Add a note..."
                            rows={3}
                            className="min-h-20 w-full resize-none rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 text-xs text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/45 focus:border-foreground/30 disabled:opacity-60"
                          />
                        </label>
                      </div>
                      {rowError?.id === event.id && (
                        <InlineError
                          message={rowError.message}
                          onRetry={() => setRowError(null)}
                        />
                      )}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={isPending}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] uppercase tracking-wider text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-50"
                        >
                          <X size={13} />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEditing(event)}
                          disabled={isPending || !editing.date}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[10px] font-medium uppercase tracking-wider text-primary-foreground transition-colors duration-150 hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPending ? <InlineSpinner /> : <Check size={13} />}
                          Save
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="read"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      {event.notes ? (
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                          {event.notes}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground/45">
                          No notes.
                        </p>
                      )}
                      {rowError?.id === event.id && (
                        <InlineError
                          message={rowError.message}
                          onRetry={() => setRowError(null)}
                          className="mt-3"
                        />
                      )}
                      {confirmDeleteId === event.id && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2">
                          <p className="text-xs text-destructive">Delete this event?</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={isPending}
                              className="h-7 px-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void confirmDelete(event)}
                              disabled={isPending}
                              className="inline-flex h-7 items-center gap-1 rounded-lg bg-destructive/15 px-2.5 text-[10px] uppercase tracking-wider text-destructive hover:bg-destructive/25 disabled:opacity-50"
                            >
                              {isPending && <InlineSpinner />}
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

function IconButton({
  children,
  label,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-lg transition-colors duration-150 ${
        tone === "danger"
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
