import { UI_CHIP_SELECTED } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

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
