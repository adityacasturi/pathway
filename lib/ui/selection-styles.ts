import { cn } from "@/lib/utils";

/** Selected toolbar control — border, fill, and label color via CSS tokens. */
export const UI_SELECTED =
  "border-[var(--selection-border)] bg-[var(--selection-bg)] text-[var(--selection-fg)]";

/** Lighter selected row / hover wash. */
export const UI_SELECTED_SUBTLE = "bg-[var(--selection-subtle-bg)]";

/** Count badge on active filter / sort controls. */
export const UI_COUNT_BADGE =
  "inline-flex size-4 items-center justify-center rounded-full bg-[var(--count-badge-bg)] text-[10px] font-semibold text-[var(--count-badge-fg)]";

/** Active chip / pill (rounded-full filters). */
export const UI_CHIP_SELECTED =
  "border-[var(--selection-border)] bg-[var(--selection-bg)] text-[var(--selection-fg)]";

export const UI_CHIP_COUNT_SELECTED =
  "bg-[var(--selection-count-bg)] text-[var(--selection-count-fg)]";

export function toolbarButtonClass(active: boolean, className?: string) {
  return cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors",
    active
      ? UI_SELECTED
      : "border-border bg-background text-foreground hover:bg-muted/45",
    className,
  );
}

export function filterPillClass(active: boolean, className?: string) {
  return cn(
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
    active
      ? UI_CHIP_SELECTED
      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
    className,
  );
}
