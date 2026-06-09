"use client";

import { useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { EventDateField } from "@/components/application-detail/event-form-fields";
import { InlineError } from "@/components/ui/inline-error";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { compareEventsNewestFirst } from "@/lib/config/application-state";
import { eventLabel, EVENT_CONFIG } from "@/lib/config/events";
import { cn } from "@/lib/utils";
import { ApplicationEvent } from "@/types/application";
import { format, parseISO } from "date-fns";

function formatTimelineDate(dateStr: string): string {
  return format(parseISO(dateStr), "MMM dd, yyyy");
}

type EventEditingState = {
  id: string;
  date: string;
  notes: string;
};

export function InspectorActivityList({
  events,
  onDeleteEvent,
  onUpdateEventDate,
  onUpdateEventNotes,
}: {
  events: ApplicationEvent[];
  onDeleteEvent: (event: ApplicationEvent) => Promise<string | null>;
  onUpdateEventDate: (event: ApplicationEvent, newDate: string) => Promise<string | null>;
  onUpdateEventNotes: (event: ApplicationEvent, notes: string) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState<EventEditingState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  if (events.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground/70">No events yet.</p>;
  }

  const ordered = [...events].sort(compareEventsNewestFirst);

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
    setConfirmDeleteId(null);
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
    <ol className="space-y-1">
      {ordered.map((event, index) => {
        const { color } = EVENT_CONFIG[event.event_type];
        const isLast = index === ordered.length - 1;
        const showConnector = !isLast;
        const isEditing = editing?.id === event.id;
        const isPending = pendingId === event.id || event.id.startsWith("temp-");
        const canEdit = !event.id.startsWith("temp-");
        const canDelete = event.event_type !== "applied" && canEdit;
        const isInteractive = canEdit && !isPending;

        const titleRowClass = "flex min-h-10 items-center justify-between gap-3 px-3";

        return (
          <li
            key={event.clientKey ?? event.id}
            className="grid grid-cols-[12px_1fr] gap-x-3"
          >
            <div className="relative flex flex-col items-center self-stretch" aria-hidden>
              <div className="relative z-10 flex min-h-10 w-full items-center justify-center">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: color }}
                />
              </div>
              {showConnector ? (
                <span className="absolute left-1/2 top-5 bottom-[-0.25rem] w-px -translate-x-1/2 bg-border" />
              ) : null}
            </div>

            <div
              role={isInteractive && !isEditing ? "button" : undefined}
              tabIndex={isInteractive && !isEditing ? 0 : undefined}
              onClick={() => {
                if (isInteractive && !isEditing) startEditing(event);
              }}
              onKeyDown={(keyEvent) => {
                if (!isInteractive || isEditing) return;
                if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                  keyEvent.preventDefault();
                  startEditing(event);
                }
              }}
              className={cn(
                "min-w-0 w-full rounded-lg border transition-[border-color,background-color,box-shadow] duration-150",
                isEditing
                  ? "border-border bg-muted/25 shadow-[0_0_0_1px_color-mix(in_oklab,var(--border)_40%,transparent)]"
                  : isInteractive
                    ? "cursor-pointer border-transparent hover:border-border/70 hover:bg-muted/20"
                    : "border-transparent",
                isPending && !isEditing && "opacity-60",
              )}
            >
              <div className={titleRowClass}>
                <p className="text-sm font-medium leading-snug text-foreground">{eventLabel(event)}</p>
                <div className="flex shrink-0 items-center gap-2">
                  {!isEditing ? (
                    <time className="text-xs tabular-nums text-muted-foreground">
                      {formatTimelineDate(event.event_date)}
                    </time>
                  ) : isPending ? (
                    <span className="text-muted-foreground" title="Syncing">
                      <InlineSpinner />
                    </span>
                  ) : null}
                </div>
              </div>

              {isEditing && editing ? (
                <div
                  className="space-y-2 px-3 pb-3"
                  onClick={(clickEvent) => clickEvent.stopPropagation()}
                >
                  <EventDateField
                    label="Date"
                    value={editing.date}
                    onChange={(date) =>
                      setEditing((current) =>
                        current?.id === event.id ? { ...current, date } : current,
                      )
                    }
                    compact
                  />
                  <textarea
                    value={editing.notes}
                    disabled={isPending}
                    autoFocus
                    onChange={(changeEvent) =>
                      setEditing((current) =>
                        current?.id === event.id ? { ...current, notes: changeEvent.target.value } : current,
                      )
                    }
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === "Escape") cancelEditing();
                      if (keyEvent.key === "Enter" && (keyEvent.metaKey || keyEvent.ctrlKey)) {
                        void saveEditing(event);
                      }
                    }}
                    placeholder="Add a note..."
                    rows={2}
                    className="min-h-9 w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-sm leading-relaxed text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/45 focus:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)] disabled:opacity-60"
                  />
                  {rowError?.id === event.id ? (
                    <InlineError message={rowError.message} onRetry={() => setRowError(null)} />
                  ) : null}
                  {confirmDeleteId === event.id ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2">
                      <p className="text-xs text-destructive">Delete this event?</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isPending}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void confirmDelete(event)}
                          disabled={isPending}
                          className="inline-flex h-7 items-center gap-1 rounded-md bg-destructive/15 px-2.5 text-xs text-destructive hover:bg-destructive/25 disabled:opacity-50"
                        >
                          {isPending ? <InlineSpinner /> : null}
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    {canDelete && confirmDeleteId !== event.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRowError(null);
                          setConfirmDeleteId(event.id);
                        }}
                        disabled={isPending}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-destructive transition-colors duration-150 hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    ) : (
                      <span aria-hidden />
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={isPending}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-50"
                      >
                        <X size={13} />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveEditing(event)}
                        disabled={isPending || !editing.date}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? <InlineSpinner /> : <Check size={13} />}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {event.notes ? (
                    <p className="px-3 pb-2.5 text-sm leading-relaxed text-muted-foreground">
                      {event.notes}
                    </p>
                  ) : null}
                  {rowError?.id === event.id ? (
                    <InlineError
                      message={rowError.message}
                      onRetry={() => setRowError(null)}
                      className="mx-3 mb-2.5"
                    />
                  ) : null}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
