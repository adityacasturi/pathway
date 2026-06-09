"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { transitions } from "@/lib/ui/motion";

/** Desktop split panel or mobile overlay for record detail. */
export function DetailDrawer({
  children,
  title,
  onClose,
  className,
  variant = "panel",
}: {
  children: ReactNode;
  title?: string;
  onClose?: () => void;
  className?: string;
  variant?: "panel" | "overlay";
}) {
  if (variant === "overlay") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_oklab,var(--ink)_25%,transparent)] md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          transition={transitions.lift}
          className={cn(
            "flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-sm",
            className,
          )}
        >
          <DetailDrawerChrome title={title} onClose={onClose}>
            {children}
          </DetailDrawerChrome>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={transitions.lift}
      className={cn(
        "flex w-full max-w-md shrink-0 flex-col border-l border-border bg-card",
        className,
      )}
      aria-label={title}
    >
      <DetailDrawerChrome title={title} onClose={onClose}>
        {children}
      </DetailDrawerChrome>
    </motion.aside>
  );
}

function DetailDrawerChrome({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title?: string;
  onClose?: () => void;
}) {
  return (
    <>
      {(title || onClose) && (
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          {title ? (
            <h2 className="truncate text-sm font-medium text-foreground">{title}</h2>
          ) : (
            <span />
          )}
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={16} strokeWidth={1.75} />
            </Button>
          ) : null}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </>
  );
}
