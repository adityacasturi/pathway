"use client";

import { useEffect, useState } from "react";
import { FilterChip } from "@/components/ui/filter-chip";
import { InspectorHoverPencil } from "@/components/inspector/inspector-hover-pencil";
import { INSPECTOR_HOVER_ROW_CLASS } from "@/components/inspector/inspector-field-styles";
import { APPLICATION_SEASONS, type ApplicationSeason } from "@/types/application";
import { cn } from "@/lib/utils";

export function InspectorSeasonField({
  value,
  onSave,
  className,
}: {
  value: ApplicationSeason | null;
  onSave: (next: ApplicationSeason | null) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <div
        className={cn(
          "w-fit max-w-full rounded-lg border border-border bg-muted/25 px-2 py-1.5",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap gap-1" role="listbox" aria-label="Choose season">
          {APPLICATION_SEASONS.map((season) => (
            <FilterChip
              key={season}
              label={season}
              active={value === season}
              onClick={() => {
                onSave(value === season ? null : season);
                setEditing(false);
              }}
              className="h-7 px-2.5 text-[12px]"
            />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = value === null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setEditing(true);
        }
      }}
      className={cn(
        INSPECTOR_HOVER_ROW_CLASS,
        "cursor-pointer py-px",
        isEmpty && "border-dashed border-border/40 hover:border-border/70",
        className,
      )}
    >
      <span
        className={cn(
          "min-w-0 text-sm capitalize",
          isEmpty ? "text-muted-foreground/55" : "text-muted-foreground",
        )}
      >
        {value ?? "Add season"}
      </span>
      <InspectorHoverPencil />
    </div>
  );
}
