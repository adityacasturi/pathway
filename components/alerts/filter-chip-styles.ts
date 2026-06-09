import { UI_CHIP_SELECTED } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

export function alertFilterChipClass(active: boolean) {
  return cn(
    "rounded-full",
    active
      ? cn(
          UI_CHIP_SELECTED,
          "shadow-[0_1px_2px_-1px_color-mix(in_oklab,var(--selection-fg)_12%,transparent)]",
        )
      : "border-border bg-background text-foreground shadow-[0_1px_2px_-1px_color-mix(in_oklab,var(--ink)_10%,transparent)] hover:border-[color-mix(in_oklab,var(--primary)_20%,var(--border))] hover:bg-muted/30",
  );
}

export function alertTargetTypeLabelClass(_type: "company" | "sector") {
  return "text-muted-foreground";
}

export function alertTypeFilterPillClass(type: "company" | "sector", active: boolean) {
  if (!active) return undefined;

  return cn(
    UI_CHIP_SELECTED,
    type === "company" ? "shadow-none" : "shadow-none",
  );
}
