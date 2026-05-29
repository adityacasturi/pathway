"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { motionVariants } from "@/lib/ui/motion";
import type { PasswordRule } from "@/lib/auth/validation";

function getPasswordQualityLabel(metCount: number, total: number) {
  if (metCount === total) return "Ready";
  if (metCount >= total - 1) return "Almost there";
  if (metCount >= 3) return "Getting stronger";
  return "Needs work";
}

export function PasswordQualityPanel({
  rules,
  id = "signup-password-rules",
}: {
  rules: PasswordRule[];
  id?: string;
}) {
  const visibleRules = rules.filter((rule) => rule.id !== "email" || !rule.met);
  const metCount = visibleRules.filter((rule) => rule.met).length;
  const quality = Math.round((metCount / visibleRules.length) * 100);
  const missingRules = rules.filter((rule) => !rule.met);
  const isComplete = missingRules.length === 0;
  const label = isComplete ? "Ready" : getPasswordQualityLabel(metCount, visibleRules.length);

  return (
    <motion.div
      id={id}
      layout
      className="rounded-lg border bg-background/70 p-3"
      style={{ borderColor: quality === 100 ? "color-mix(in oklab, var(--primary) 28%, var(--rule))" : "var(--rule)" }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 36, mass: 0.7 } }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
              quality === 100 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {quality === 100 ? <CheckCircle2 className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">8+ chars with A/a/1/!</p>
          </div>
        </div>
        <span className="font-mono text-[11px] tabular text-muted-foreground">
          {metCount}/{visibleRules.length}
        </span>
      </div>

      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${visibleRules.length}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {visibleRules.map((rule) => (
          <motion.span
            key={rule.id}
            layout
            className={`h-1 rounded-full transition-colors duration-200 ${
              rule.met ? "bg-primary" : "bg-[color-mix(in_oklab,var(--ink)_9%,transparent)]"
            }`}
          />
        ))}
      </div>

      <AnimatePresence initial={false} mode="wait">
        <motion.p
          key={isComplete ? "complete" : missingRules.map((rule) => rule.id).join("-")}
          variants={motionVariants.step}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`mt-3 text-[12px] leading-relaxed ${
            isComplete ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {isComplete
            ? "Your password is strong enough."
            : `Add ${missingRules.map((rule) => rule.label.toLowerCase()).join(", ")}.`}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}
