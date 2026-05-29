"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";
import { ApplicationEvent } from "@/types/application";
import { getOaDeadlineState } from "@/lib/config/deadlines";
import { EVENT_CONFIG, eventLabel } from "@/lib/config/events";
import { IconButton } from "@/components/event-timeline/action-buttons";
import { DeadlinePanel } from "@/components/event-timeline/deadline-panel";
import { EventEditForm, EventEditingState } from "@/components/event-timeline/event-edit-form";
import { OfferDot } from "@/components/status-badge";
import { InlineError } from "@/components/ui/inline-error";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { transitions } from "@/lib/ui/motion";
import { formatDate } from "@/lib/utils";

interface Props {
  events: ApplicationEvent[];
  onDeleteEvent: (event: ApplicationEvent) => Promise<string | null>;
  onUpdateEventDate: (event: ApplicationEvent, newDate: string) => Promise<string | null>;
  onUpdateEventNotes: (event: ApplicationEvent, notes: string) => Promise<string | null>;
  onUpdateEventDeadline: (event: ApplicationEvent, deadlineDate: string | null) => Promise<string | null>;
  onUpdateEventDeadlineCompletion: (event: ApplicationEvent, completed: boolean) => Promise<string | null>;
}

type EditingState = EventEditingState | null;

function eventKey(event: ApplicationEvent) {
  return event.clientKey ?? event.id;
}

export function EventTimeline({
  events,
  onDeleteEvent,
  onUpdateEventDate,
  onUpdateEventNotes,
  onUpdateEventDeadline,
  onUpdateEventDeadlineCompletion,
}: Props) {
  const [editing, setEditing] = useState<EditingState>(null);
  const [editingDeadline, setEditingDeadline] = useState<{ id: string; deadlineDate: string } | null>(null);
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
    setEditingDeadline(null);
    setEditing({
      id: event.id,
      date: event.event_date,
      notes: event.notes ?? "",
    });
  }

  function cancelEditing() {
    setEditing(null);
    setEditingDeadline(null);
    setRowError(null);
  }

  function startDeadlineEditing(event: ApplicationEvent) {
    if (event.id.startsWith("temp-")) return;
    setEditing(null);
    setConfirmDeleteId(null);
    setRowError(null);
    setEditingDeadline({
      id: event.id,
      deadlineDate: event.deadline_date ?? "",
    });
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
      if (editingDeadline?.id === event.id) setEditingDeadline(null);
    }
    setPendingId(null);
  }

  async function saveDeadline(event: ApplicationEvent) {
    if (!editingDeadline || editingDeadline.id !== event.id || pendingId) return;
    setPendingId(event.id);
    setRowError(null);
    const error = await onUpdateEventDeadline(event, editingDeadline.deadlineDate || null);
    if (error) {
      setRowError({ id: event.id, message: error });
    } else {
      setEditingDeadline(null);
    }
    setPendingId(null);
  }

  async function removeDeadline(event: ApplicationEvent) {
    if (pendingId) return;
    setPendingId(event.id);
    setRowError(null);
    const error = await onUpdateEventDeadline(event, null);
    if (error) setRowError({ id: event.id, message: error });
    else setEditingDeadline(null);
    setPendingId(null);
  }

  async function toggleDeadlineCompletion(event: ApplicationEvent, completed: boolean) {
    if (pendingId) return;
    setPendingId(event.id);
    setRowError(null);
    const error = await onUpdateEventDeadlineCompletion(event, completed);
    if (error) setRowError({ id: event.id, message: error });
    setPendingId(null);
  }

  return (
    <ol className="relative space-y-0">
      <AnimatePresence initial={false}>
        {events.map((event, index) => {
          const { color } = EVENT_CONFIG[event.event_type];
          const isLast = index === events.length - 1;
          const isEditing = editing?.id === event.id;
          const isPending = pendingId === event.id || event.id.startsWith("temp-");
          const canDelete = event.event_type !== "applied" && !event.id.startsWith("temp-");
          const deadlineState = getOaDeadlineState({ events }, event);
          const isDeadlineEditing = editingDeadline?.id === event.id;

          return (
            <motion.li
              key={eventKey(event)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: transitions.timelineFade }}
              transition={transitions.timelineFade}
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

                  {isEditing ? (
                    <EventEditForm
                      editing={editing}
                      pending={isPending}
                      errorMessage={rowError?.id === event.id ? rowError.message : null}
                      onDateChange={(date) =>
                        setEditing((current) =>
                          current?.id === event.id ? { ...current, date } : current,
                        )
                      }
                      onNotesChange={(notes) =>
                        setEditing((current) =>
                          current?.id === event.id ? { ...current, notes } : current,
                        )
                      }
                      onCancel={cancelEditing}
                      onClearError={() => setRowError(null)}
                      onSave={() => void saveEditing(event)}
                    />
                  ) : (
                    <div>
                        {event.notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {event.notes}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground/45">No notes.</p>
                        )}
                        {rowError?.id === event.id && (
                          <InlineError
                            message={rowError.message}
                            onRetry={() => setRowError(null)}
                            className="mt-3"
                          />
                        )}
                        {event.event_type === "oa" && (
                          <DeadlinePanel
                            event={event}
                            state={deadlineState}
                            editing={isDeadlineEditing ? editingDeadline : null}
                            pending={isPending}
                            onStartEdit={() => startDeadlineEditing(event)}
                            onDraftChange={(deadlineDate) =>
                              setEditingDeadline((current) =>
                                current?.id === event.id ? { ...current, deadlineDate } : current,
                              )
                            }
                            onSave={() => void saveDeadline(event)}
                            onCancel={() => setEditingDeadline(null)}
                            onRemove={() => void removeDeadline(event)}
                            onToggleComplete={(completed) =>
                              void toggleDeadlineCompletion(event, completed)
                            }
                          />
                        )}
                        <AnimatePresence initial={false}>
                          {confirmDeleteId === event.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 2 }}
                              transition={transitions.timelineFade}
                              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2"
                            >
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
                            </motion.div>
                          )}
                        </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
