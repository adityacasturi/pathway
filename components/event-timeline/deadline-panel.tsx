"use client";

import { CalendarClock, Check, Pencil, Trash2, X } from "lucide-react";
import { ApplicationEvent } from "@/types/application";
import { deadlineStatusLabel, OaDeadlineState } from "@/lib/config/deadlines";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { formatDate } from "@/lib/utils";
import { DeadlineActionButton } from "@/components/event-timeline/action-buttons";

const DEADLINE_SAVE_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[10px] font-medium uppercase tracking-wider text-primary-foreground transition-colors duration-150 hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60";

export function DeadlinePanel({
  event,
  state,
  editing,
  pending,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
  onRemove,
  onToggleComplete,
}: {
  event: ApplicationEvent;
  state: OaDeadlineState | null;
  editing: { id: string; deadlineDate: string } | null;
  pending: boolean;
  onStartEdit: () => void;
  onDraftChange: (deadlineDate: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onToggleComplete: (completed: boolean) => void;
}) {
  const toneClass =
    state?.status === "overdue"
      ? "border-destructive/25 bg-destructive/10 text-destructive"
      : state?.status === "urgent"
        ? "border-border/70 bg-background/70 text-foreground"
        : "border-border/70 bg-background/70 text-muted-foreground";

  if (editing) {
    return (
      <div className="mt-3 rounded-lg border border-border/70 bg-background/70 p-3">
        <label className="block space-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Deadline</span>
          <input
            type="date"
            value={editing.deadlineDate}
            disabled={pending}
            onChange={(changeEvent) => onDraftChange(changeEvent.target.value)}
            className="date-input h-9 w-full rounded-lg border border-border/70 bg-background/80 px-2.5 text-xs outline-none transition-colors duration-150 focus:border-foreground/30 disabled:opacity-60"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-8 rounded-lg px-2.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className={DEADLINE_SAVE_BUTTON_CLASS}
          >
            {pending ? <InlineSpinner /> : <Check size={13} />}
            Save
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <button
        type="button"
        onClick={onStartEdit}
        disabled={pending || event.id.startsWith("temp-")}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] uppercase tracking-wider text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-50"
        style={{ borderColor: "var(--rule)" }}
      >
        <CalendarClock size={13} />
        Add deadline
      </button>
    );
  }

  const completionNote =
    state.completionReason === "progressed"
      ? "Progressed"
      : state.completionReason === "manual"
        ? "Completed"
        : null;

  return (
    <div className={`mt-2 rounded-md border px-2.5 py-2 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <CalendarClock size={14} className="shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em]">
            {deadlineStatusLabel(state)}
          </span>
          <span className="truncate text-xs opacity-75">
            {formatDate(state.deadlineDate)}
          </span>
          {completionNote && (
            <span className="text-[10px] uppercase tracking-wider opacity-60">
              {completionNote}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <DeadlineActionButton
            label={state.completionReason === "manual" ? "Reopen deadline" : "Mark deadline done"}
            onClick={() => onToggleComplete(state.completionReason !== "manual")}
            disabled={pending}
          >
            {state.completionReason === "manual" ? <X size={13} /> : <Check size={13} />}
          </DeadlineActionButton>
          <DeadlineActionButton
            label="Edit deadline"
            onClick={onStartEdit}
            disabled={pending}
          >
            <Pencil size={13} />
          </DeadlineActionButton>
          <DeadlineActionButton
            label="Remove deadline"
            tone="danger"
            onClick={onRemove}
            disabled={pending}
          >
            <Trash2 size={13} />
          </DeadlineActionButton>
        </div>
      </div>
    </div>
  );
}
