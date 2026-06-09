"use client";

import { format, parseISO } from "date-fns";
import { EventDot } from "@/components/status-badge";
import { ADDABLE_EVENT_TYPES, EVENT_CONFIG } from "@/lib/config/events";
import { cn } from "@/lib/utils";
import { EventType } from "@/types/application";

const EVENT_TYPE_BUTTON_CLASS =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors duration-150";

export function EventTypePicker({
  value,
  onChange,
  layout = "grid",
}: {
  value: EventType;
  onChange: (type: EventType) => void;
  layout?: "grid" | "row";
}) {
  return (
    <div
      role="group"
      aria-label="Event type"
      className={cn(
        layout === "row" ? "flex flex-wrap gap-1.5" : "grid grid-cols-2 gap-1.5",
      )}
    >
      {ADDABLE_EVENT_TYPES.map((type) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            aria-pressed={active}
            className={cn(
              EVENT_TYPE_BUTTON_CLASS,
              active
                ? "border-[var(--selection-border)] bg-[var(--selection-bg)] text-[var(--selection-fg)]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/45 hover:text-foreground",
            )}
          >
            <EventDot type={type} size={6} />
            {EVENT_CONFIG[type].label}
          </button>
        );
      })}
    </div>
  );
}

export function EventDateField({
  label = "Date",
  value,
  onChange,
  optional = false,
  compact = false,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
  compact?: boolean;
}) {
  const selected = value ? parseISO(value) : undefined;

  if (compact) {
    return (
      <label className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-foreground/65">
          {label}
          {optional ? <span className="text-muted-foreground/60"> (optional)</span> : null}
        </span>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          title={selected ? format(selected, "MMM d, yyyy") : undefined}
          className="date-input h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors duration-150 focus:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)]"
        />
      </label>
    );
  }

  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground/65">
        {label}
        {optional ? <span className="text-muted-foreground/60"> (optional)</span> : null}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={selected ? format(selected, "MMM d, yyyy") : undefined}
        className="date-input h-8 w-full min-w-0 rounded-md border border-border bg-background px-2.5 text-sm outline-none transition-colors duration-150 focus:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_12%,transparent)]"
      />
    </label>
  );
}
