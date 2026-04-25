"use client";

import { Check } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";

type AsyncState = "idle" | "pending" | "success" | "error";

export function AsyncButton({
  state,
  idleLabel,
  pendingLabel,
  successLabel,
  errorLabel,
  className,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  state: AsyncState;
  idleLabel: string;
  pendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
}) {
  const labels = useMemo(
    () => [idleLabel, pendingLabel ?? idleLabel, successLabel ?? idleLabel, errorLabel ?? idleLabel],
    [errorLabel, idleLabel, pendingLabel, successLabel],
  );

  const widestLabel = useMemo(
    () => labels.reduce((widest, current) => (current.length > widest.length ? current : widest), labels[0]),
    [labels],
  );

  const label = useMemo(() => {
    if (state === "pending") return pendingLabel ?? idleLabel;
    if (state === "success") return successLabel ?? idleLabel;
    if (state === "error") return errorLabel ?? idleLabel;
    return idleLabel;
  }, [errorLabel, idleLabel, pendingLabel, state, successLabel]);

  return (
    <Button {...props} className={cn(className)} disabled={disabled || state === "pending"}>
      <span className="relative inline-grid place-items-center">
        <span className="invisible flex items-center gap-1">
          <span className="size-3.5 shrink-0" aria-hidden />
          <span>{widestLabel}</span>
        </span>
        <span className="absolute inset-0 flex items-center justify-center gap-1">
          <span className="inline-flex size-3.5 shrink-0 items-center justify-center" aria-hidden>
            {state === "pending" && <InlineSpinner />}
            {state === "success" && <Check className="size-3.5" />}
          </span>
          <span>{label}</span>
        </span>
      </span>
    </Button>
  );
}
