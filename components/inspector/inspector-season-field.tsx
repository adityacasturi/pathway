"use client";

import { RefreshCw } from "lucide-react";
import {
  INSPECTOR_HOVER_PENCIL_CLASS,
  INSPECTOR_HOVER_ROW_CLASS,
} from "@/components/inspector/inspector-field-styles";
import { SeasonDot } from "@/components/season-filter-section";
import { APPLICATION_SEASONS, type ApplicationSeason } from "@/types/application";
import { cn } from "@/lib/utils";

function nextSeason(current: ApplicationSeason | null): ApplicationSeason | null {
  if (current === null) return APPLICATION_SEASONS[0] ?? null;
  const index = APPLICATION_SEASONS.indexOf(current);
  if (index < 0 || index === APPLICATION_SEASONS.length - 1) return null;
  return APPLICATION_SEASONS[index + 1] ?? null;
}

export function InspectorSeasonField({
  value,
  onSave,
  className,
}: {
  value: ApplicationSeason | null;
  onSave: (next: ApplicationSeason | null) => void;
  className?: string;
}) {
  const isEmpty = value === null;

  return (
    <button
      type="button"
      onClick={() => onSave(nextSeason(value))}
      aria-pressed={value !== null}
      aria-label={value ? `Season: ${value}. Click to cycle.` : "Add season"}
      className={cn(
        INSPECTOR_HOVER_ROW_CLASS,
        "cursor-pointer py-px text-left",
        isEmpty && "border-dashed border-border/40 hover:border-border/70",
        className,
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {value ? <SeasonDot season={value} /> : null}
        <span
          className={cn(
            "min-w-0 text-sm capitalize",
            isEmpty ? "text-muted-foreground/55" : "text-muted-foreground",
          )}
        >
          {value ?? "Add season"}
        </span>
      </span>
      <span className={INSPECTOR_HOVER_PENCIL_CLASS} aria-hidden>
        <RefreshCw size={13} strokeWidth={1.75} />
      </span>
    </button>
  );
}
