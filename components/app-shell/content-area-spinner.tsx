"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { APP_SHELL_CSS_VARS } from "@/components/app-shell/shell-layout";
import { cn } from "@/lib/utils";

/**
 * Spinner locked to the main content pane (below top bar, right of sidebar).
 * Portaled to document.body with explicit shell vars so it always paints above
 * route content.
 */
export function ContentAreaSpinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="content-area-spinner"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          "fixed z-[48] flex items-center justify-center",
          "bg-background",
          "top-[var(--app-topbar-height)] right-0 bottom-0 left-0",
          "md:left-[var(--app-sidebar-width)]",
          className,
        )}
        style={APP_SHELL_CSS_VARS}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2
          size={22}
          strokeWidth={1.75}
          className="animate-spin text-muted-foreground"
          aria-hidden
        />
        <span className="sr-only">{label}</span>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
