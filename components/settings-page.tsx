"use client";

import { type FormEvent, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { CalendarDays, LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { updateDiscoverCutoffDate } from "@/lib/actions/settings";
import { motionVariants } from "@/lib/ui/motion";
import { AsyncButton } from "@/components/ui/async-button";
import { InlineError } from "@/components/ui/inline-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  userEmail: string | null | undefined;
  discoverCutoffDate: string;
  oldestAllowedDiscoverCutoffDate: string;
  latestAllowedDiscoverCutoffDate: string;
}

export function SettingsPage({
  userEmail,
  discoverCutoffDate,
  oldestAllowedDiscoverCutoffDate,
  latestAllowedDiscoverCutoffDate,
}: Props) {
  const safeEmail = userEmail ?? "";
  const initials = getInitials(safeEmail);
  const [cutoffDate, setCutoffDate] = useState(discoverCutoffDate);
  const [savedCutoffDate, setSavedCutoffDate] = useState(discoverCutoffDate);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onCutoffChange(next: string) {
    setCutoffDate(next);
    setSaveState("idle");
    setError(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const result = await updateDiscoverCutoffDate(cutoffDate);
      if (result?.error) {
        setSaveState("error");
        setError(result.error);
        return;
      }
      setSaveState("success");
      if (result?.cutoffDate) {
        setCutoffDate(result.cutoffDate);
        setSavedCutoffDate(result.cutoffDate);
      }
    });
  }

  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-6 sm:px-10 lg:px-16 pt-18 sm:pt-20 lg:pt-24 pb-24">
        <motion.header
          className="mb-10"
          variants={motionVariants.riseIn}
          initial="hidden"
          animate="visible"
        >
          <h1 className="display-serif text-[2.75rem] text-foreground sm:text-[3.25rem]">
            Settings
          </h1>
        </motion.header>

        <motion.div
          variants={motionVariants.fadeIn}
          initial="hidden"
          animate="visible"
        >
          <Section label="01" title="Account">
            <div className="flex items-center gap-5 py-5">
              <div
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-medium tracking-[0.1em] uppercase text-foreground"
                style={{ background: "color-mix(in oklab, var(--ink) 7%, transparent)" }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="label-meta">Signed in as</p>
                <p className="mt-1 truncate text-[16px] font-medium text-foreground tracking-tight">
                  {safeEmail || "-"}
                </p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <LogOut size={12} strokeWidth={1.75} />
                  Sign out
                </button>
              </form>
            </div>
          </Section>

          <Section label="02" title="Discover">
            <form onSubmit={onSubmit}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="discover-cutoff" className="label-meta mb-2 block">
                    Posted after
                  </Label>
                  <div className="relative max-w-56">
                    <CalendarDays
                      size={14}
                      strokeWidth={1.75}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="discover-cutoff"
                      type="date"
                      value={cutoffDate}
                      min={oldestAllowedDiscoverCutoffDate}
                      max={latestAllowedDiscoverCutoffDate}
                      required
                      onChange={(event) => onCutoffChange(event.target.value)}
                      className="h-9 pl-8 tabular"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="label-meta tabular">
                    {oldestAllowedDiscoverCutoffDate} - {latestAllowedDiscoverCutoffDate}
                  </span>
                  <AsyncButton
                    type="submit"
                    size="sm"
                    state={isPending ? "pending" : saveState}
                    idleLabel="Save"
                    pendingLabel="Saving"
                    successLabel="Saved"
                    errorLabel="Retry"
                    disabled={cutoffDate === savedCutoffDate && saveState !== "error"}
                  />
                </div>
              </div>
              {error && (
                <div className="mt-4">
                  <InlineError message={error} onRetry={() => setError(null)} />
                </div>
              )}
            </form>
          </Section>
        </motion.div>
      </main>
    </div>
  );
}

function Section({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="label-micro">{label}</span>
        <h2 className="display-serif text-[24px] text-foreground">{title}</h2>
      </div>
      {description && (
        <p className="mb-5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      <span className="rule mb-0" />
      <div className="py-5">{children}</div>
      <span className="rule mt-0" />
    </section>
  );
}

function getInitials(email: string): string {
  if (!email) return "U";
  const name = email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.slice(0, 1).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
