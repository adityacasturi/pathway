"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { updateDigestEnabled } from "@/lib/actions/alerts";
import { DAILY_BRIEFING_COPY } from "@/lib/config/alerts";
import { toolbarButtonClass } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

export function AlertsDailyBriefingToolbarButton({
  enabled: initialEnabled,
  className,
}: {
  enabled: boolean;
  className?: string;
}) {
  const router = useRouter();
  const hintId = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await updateDigestEnabled(next);
      if (result?.error) {
        setEnabled(previous);
        toast.error("Couldn't update daily email", { description: result.error });
        return;
      }
      toast.success(next ? `${DAILY_BRIEFING_COPY.label} on` : `${DAILY_BRIEFING_COPY.label} off`);
      router.refresh();
    });
  }

  return (
    <div className={cn("group/hint relative shrink-0", className)} title={DAILY_BRIEFING_COPY.hint}>
      <div
        className={cn(
          toolbarButtonClass(enabled, "gap-1.5 px-2"),
          pending && "opacity-60",
        )}
        aria-describedby={hintId}
      >
        <span className="text-sm font-medium">{DAILY_BRIEFING_COPY.label}</span>
        <Switch
          checked={enabled}
          disabled={pending}
          onCheckedChange={toggle}
          aria-label={DAILY_BRIEFING_COPY.label}
          className="scale-90"
        />
      </div>
      <div
        id={hintId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute right-0 top-[calc(100%+6px)] z-50 hidden w-[min(24rem,calc(100vw-1.5rem))]",
          "rounded-md border border-border bg-card px-3 py-1.5 text-xs leading-snug text-muted-foreground shadow-sm",
          "group-hover/hint:block group-focus-within/hint:block",
        )}
      >
        {DAILY_BRIEFING_COPY.hint}
      </div>
    </div>
  );
}
