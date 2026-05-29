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

  const isPending = state === "pending";
  const isSuccess = state === "success";

  return (
    <Button
      {...props}
      aria-busy={isPending}
      className={cn(
        "inline-flex min-w-[4.75rem] items-center justify-center gap-1.5 overflow-hidden",
        className,
      )}
      disabled={disabled || isPending}
    >
      {isPending ? (
        <InlineSpinner className="shrink-0" />
      ) : isSuccess ? (
        <Check className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      ) : null}
      <span className="shrink-0 whitespace-nowrap">{label}</span>
    </Button>
  );
}
