import { cn } from "@/lib/utils";

/** Outline add control for company rows in the add-alert dialog. */
export function addAlertPillButtonClass(pending?: boolean) {
  return cn(
    "inline-flex h-8 w-[4.75rem] shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-[background-color,border-color,opacity] hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60",
    pending && "border-border/80 bg-muted/30",
  );
}

/** Circular add/toggle control for bundles and feeds in the add-alert dialog. */
export function addAlertIconButtonClass(pending?: boolean) {
  return cn(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-[background-color,border-color,opacity] hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60",
    pending && "border-border/80 bg-muted/30",
  );
}

export const ADD_ALERT_ROW_PENDING_CLASS = "bg-muted/20";
