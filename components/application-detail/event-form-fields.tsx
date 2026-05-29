"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { EventDot } from "@/components/status-badge";
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { ADDABLE_EVENT_TYPES, EVENT_CONFIG } from "@/lib/config/events";
import { EventType } from "@/types/application";

export function EventTypePicker({
  value,
  onChange,
  layout = "grid",
}: {
  value: EventType;
  onChange: (type: EventType) => void;
  layout?: "grid" | "row";
}) {
  if (layout === "row") {
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Event type">
        {ADDABLE_EVENT_TYPES.map((type) => {
          const active = value === type;
          return (
            <ToolbarPill
              key={type}
              active={active}
              onClick={() => onChange(type)}
              className="gap-1.5 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em]"
            >
              <EventDot type={type} />
              {EVENT_CONFIG[type].label}
            </ToolbarPill>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Type</span>
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
              style={active ? undefined : { borderColor: "var(--rule)" }}
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

export function EventDateField({
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
        className="date-input h-9 w-full min-w-0 rounded-md border border-border/70 bg-background/80 px-2.5 text-xs outline-none transition-colors duration-150 focus:border-foreground/30 focus:bg-background"
      />
    </label>
  );
}
