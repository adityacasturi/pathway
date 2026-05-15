"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { CalendarDays, Loader2, LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { updateAccentColor, updateDiscoverCutoffDate } from "@/lib/actions/settings";
import {
  ACCENT_OPTIONS,
  type AccentColor,
} from "@/lib/config/accent";
import { motionVariants } from "@/lib/ui/motion";
import { saveAccentColorPreference } from "@/components/accent-theme-provider";
import { AsyncButton } from "@/components/ui/async-button";
import { InlineError } from "@/components/ui/inline-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageMain, PageSection, PageShell } from "@/components/ui/page";

interface Props {
  userEmail: string | null | undefined;
  discoverCutoffDate: string;
  accentColor: AccentColor;
  oldestAllowedDiscoverCutoffDate: string;
  latestAllowedDiscoverCutoffDate: string;
}

function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground active:translate-y-px active:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] disabled:border-rule-strong disabled:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] disabled:text-foreground"
      style={{ borderColor: "var(--rule)" }}
    >
      {pending ? (
        <Loader2 size={12} strokeWidth={1.75} className="animate-spin" />
      ) : (
        <LogOut size={12} strokeWidth={1.75} />
      )}
      {pending ? "Signing out" : "Sign out"}
    </button>
  );
}

export function SettingsPage({
  userEmail,
  discoverCutoffDate,
  accentColor,
  oldestAllowedDiscoverCutoffDate,
  latestAllowedDiscoverCutoffDate,
}: Props) {
  const safeEmail = userEmail ?? "";
  const initials = getInitials(safeEmail);
  const [cutoffDate, setCutoffDate] = useState(discoverCutoffDate);
  const [savedCutoffDate, setSavedCutoffDate] = useState(discoverCutoffDate);
  const [isDiscoverPending, startDiscoverTransition] = useTransition();
  const [isAccentPending, startAccentTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle");
  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(accentColor);
  const [savedAccent, setSavedAccent] = useState<AccentColor>(accentColor);
  const [accentSaveState, setAccentSaveState] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [accentError, setAccentError] = useState<string | null>(null);

  useEffect(() => {
    saveAccentColorPreference(accentColor);
  }, [accentColor]);

  function onCutoffChange(next: string) {
    setCutoffDate(next);
    setSaveState("idle");
    setError(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startDiscoverTransition(async () => {
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

  function onAccentSelect(next: AccentColor) {
    setSelectedAccent(next);
    setAccentSaveState("idle");
    setAccentError(null);
    saveAccentColorPreference(next);
  }

  function onAccentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAccentTransition(async () => {
      setAccentError(null);
      const result = await updateAccentColor(selectedAccent);
      if (result?.error) {
        setAccentSaveState("error");
        setAccentError(result.error);
        return;
      }
      setAccentSaveState("success");
      if (result?.accentColor) {
        setSelectedAccent(result.accentColor);
        setSavedAccent(result.accentColor);
        saveAccentColorPreference(result.accentColor);
      }
    });
  }

  return (
    <PageShell>
      <PageMain width="md">
        <motion.div variants={motionVariants.riseIn} initial={false} animate="visible">
          <PageHeader title="Settings" />
        </motion.div>

        <motion.div
          variants={motionVariants.fadeIn}
          initial={false}
          animate="visible"
        >
          <PageSection label="01" title="Account">
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
                <SignOutButton />
              </form>
            </div>
          </PageSection>

          <PageSection label="02" title="Discover">
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
                    {formatShortDate(cutoffDate)} - today
                  </span>
                  <AsyncButton
                    type="submit"
                    size="sm"
                    state={isDiscoverPending ? "pending" : saveState}
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
          </PageSection>

          <PageSection label="03" title="Appearance">
            <form onSubmit={onAccentSubmit}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="label-meta mb-3">Accent color</p>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="radiogroup" aria-label="Accent color">
                    {ACCENT_OPTIONS.map((option) => {
                      const isSelected = selectedAccent === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => onAccentSelect(option.id)}
                          className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors duration-150 ${
                            isSelected ? "border-[color:var(--primary)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] text-foreground" : "border-rule text-muted-foreground hover:border-rule-strong hover:text-foreground"
                          }`}
                        >
                          <span
                            className="size-4 rounded-full border border-black/10"
                            style={{ background: option.swatch }}
                            aria-hidden
                          />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <AsyncButton
                  type="submit"
                  size="sm"
                  state={isAccentPending ? "pending" : accentSaveState}
                  idleLabel="Save"
                  pendingLabel="Saving"
                  successLabel="Saved"
                  errorLabel="Retry"
                  disabled={selectedAccent === savedAccent && accentSaveState !== "error"}
                />
              </div>
              {accentError && (
                <div className="mt-4">
                  <InlineError message={accentError} onRetry={() => setAccentError(null)} />
                </div>
              )}
            </form>
          </PageSection>

        </motion.div>
      </PageMain>
    </PageShell>
  );
}

function getInitials(email: string): string {
  if (!email) return "U";
  const name = email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.slice(0, 1).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function formatShortDate(value: string): string {
  const [year, month, day] = value.split("-");
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (!year || !Number.isFinite(monthNumber) || !Number.isFinite(dayNumber)) return value;
  return `${monthNumber}/${dayNumber}/${year}`;
}
