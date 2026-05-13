"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";
import { motionVariants } from "@/lib/ui/motion";

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
      <AnimatePresence mode="popLayout" initial={false}>
        {state === "pending" && (
          <motion.span
            key="pending-icon"
            variants={motionVariants.step}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="inline-flex"
          >
            <InlineSpinner className="shrink-0" />
          </motion.span>
        )}
        {state === "success" && (
          <motion.span
            key="success-icon"
            variants={motionVariants.step}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="inline-flex"
          >
            <Check className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
      <span className="relative inline-flex min-w-0 overflow-visible">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={label}
            variants={motionVariants.step}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="shrink-0 text-center leading-[1.2] whitespace-nowrap"
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
    </Button>
  );
}
