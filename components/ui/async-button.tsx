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
  const label = useMemo(() => {
    if (state === "pending") return pendingLabel ?? idleLabel;
    if (state === "success") return successLabel ?? idleLabel;
    if (state === "error") return errorLabel ?? idleLabel;
    return idleLabel;
  }, [errorLabel, idleLabel, pendingLabel, state, successLabel]);

  return (
    <Button
      {...props}
      className={cn("inline-flex items-center justify-center", className)}
      disabled={disabled || state === "pending"}
    >
      {state === "pending" && <InlineSpinner className="shrink-0" />}
      {state === "success" && <Check className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />}
      <span className="shrink-0 text-center leading-none whitespace-nowrap">{label}</span>
    </Button>
  );
}
