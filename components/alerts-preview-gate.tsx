"use client";

import { motion } from "framer-motion";
import { Mail, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertsPreviewGateProps {
  active: boolean;
  children: React.ReactNode;
}

export function AlertsPreviewGate({ active, children }: AlertsPreviewGateProps) {
  if (!active) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none select-none",
          "opacity-[0.42] saturate-[0.35] blur-[2px]",
          "[mask-image:linear-gradient(to_bottom,black_0%,black_72%,transparent_100%)]",
        )}
      >
        {children}
      </div>

      <div
        className="fixed inset-0 z-20 flex items-start justify-center px-4 pt-[min(18vh,9rem)] sm:pt-[min(20vh,10rem)]"
        role="region"
        aria-label="Email alerts coming soon"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-md"
        >
          <div className="relative overflow-hidden rounded-2xl border border-[color:color-mix(in_oklab,var(--primary)_22%,var(--border))] bg-[color-mix(in_oklab,var(--card)_92%,var(--paper))] px-6 py-7 shadow-[0_32px_64px_-40px_color-mix(in_oklab,var(--ink)_45%,transparent),0_0_0_1px_color-mix(in_oklab,var(--primary)_8%,transparent)]">
            <div
              className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -left-6 bottom-0 size-24 rounded-full bg-[color-mix(in_oklab,var(--accent)_35%,transparent)] blur-xl"
              aria-hidden
            />

            <div className="relative flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--primary)_25%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] text-[color:var(--primary)]">
                <Mail size={20} strokeWidth={1.5} aria-hidden />
              </div>

              <div className="min-w-0 flex-1">
                <p className="label-meta flex items-center gap-1.5 text-[color:var(--primary)]">
                  <Sparkles size={12} strokeWidth={1.75} aria-hidden />
                  Coming soon
                </p>
                <h2 className="mt-1 text-[20px] font-medium tracking-tight text-foreground">
                  Same-minute email alerts
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  The moment a new role hits our feed at a company or sector you follow,
                  you&apos;ll know—often within minutes, not hours later. We&apos;re putting the
                  finishing touches on it now.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
