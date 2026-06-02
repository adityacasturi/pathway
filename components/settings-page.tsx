"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { Loader2, LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { updateAccentColor, updateQuickTrackEnabled } from "@/lib/actions/settings";
import {
  ACCENT_OPTIONS,
  type AccentColor,
} from "@/lib/config/accent";
import { getPageLabel } from "@/lib/config/nav";
import { motionVariants } from "@/lib/ui/motion";
import { saveAccentColorPreference } from "@/components/accent-theme-provider";
import { InlineError } from "@/components/ui/inline-error";
import { PageHeader, PageMain, PageSection, PageShell } from "@/components/ui/page";
import { Switch } from "@/components/ui/switch";

interface Props {
  userEmail: string | null | undefined;
  accentColor: AccentColor;
  quickTrackEnabled: boolean;
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
  accentColor,
  quickTrackEnabled: initialQuickTrackEnabled,
}: Props) {
  const safeEmail = userEmail ?? "";
  const initials = getInitials(safeEmail);
  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(accentColor);
  const [savedAccent, setSavedAccent] = useState<AccentColor>(accentColor);
  const [, startAccentTransition] = useTransition();
  const [accentError, setAccentError] = useState<string | null>(null);
  const [quickTrackEnabled, setQuickTrackEnabled] = useState(initialQuickTrackEnabled);
  const [savedQuickTrackEnabled, setSavedQuickTrackEnabled] = useState(initialQuickTrackEnabled);
  const [isQuickTrackPending, startQuickTrackTransition] = useTransition();
  const [quickTrackError, setQuickTrackError] = useState<string | null>(null);

  useEffect(() => {
    saveAccentColorPreference(accentColor);
  }, [accentColor]);

  function onAccentSelect(next: AccentColor) {
    if (next === selectedAccent) return;
    setSelectedAccent(next);
    setAccentError(null);
    saveAccentColorPreference(next);
    startAccentTransition(async () => {
      const result = await updateAccentColor(next);
      if (result?.error) {
        setAccentError(result.error);
        setSelectedAccent(savedAccent);
        saveAccentColorPreference(savedAccent);
        return;
      }
      const persisted = result?.accentColor ?? next;
      setSelectedAccent(persisted);
      setSavedAccent(persisted);
      saveAccentColorPreference(persisted);
    });
  }

  function onQuickTrackChange(next: boolean) {
    setQuickTrackEnabled(next);
    setQuickTrackError(null);
    startQuickTrackTransition(async () => {
      const result = await updateQuickTrackEnabled(next);
      if (result?.error) {
        setQuickTrackEnabled(savedQuickTrackEnabled);
        setQuickTrackError(result.error);
        return;
      }
      if (result?.quickTrackEnabled !== undefined) {
        setQuickTrackEnabled(result.quickTrackEnabled);
        setSavedQuickTrackEnabled(result.quickTrackEnabled);
      }
    });
  }

  return (
    <PageShell>
      <PageMain width="md">
        <motion.div variants={motionVariants.riseIn} initial={false} animate="visible">
          <PageHeader title={getPageLabel("/settings")} />
        </motion.div>

        <motion.div
          variants={motionVariants.fadeIn}
          initial={false}
          animate="visible"
        >
          <PageSection title="Account">
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

          <PageSection title="Preferences" contentClassName="py-0">
            <div className="divide-y" style={{ borderColor: "var(--rule)" }}>
              <div className="py-5">
                <p className="label-meta">Accent color</p>
                <div
                  className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
                  role="radiogroup"
                  aria-label="Accent color"
                >
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
                          isSelected
                            ? "border-[color:var(--primary)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] text-foreground"
                            : "border-[color:var(--rule)] text-muted-foreground hover:border-[color:var(--rule-strong)] hover:text-foreground"
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
                {accentError && (
                  <div className="mt-3">
                    <InlineError message={accentError} onRetry={() => setAccentError(null)} />
                  </div>
                )}
              </div>

              <div className="py-5">
                <div className="flex items-center justify-between gap-6">
                  <p className="label-meta">Quick track</p>
                  <Switch
                    checked={quickTrackEnabled}
                    disabled={isQuickTrackPending}
                    onCheckedChange={onQuickTrackChange}
                    aria-label={
                      quickTrackEnabled
                        ? "Disable quick track: add from Overview or Companies without a confirmation dialog"
                        : "Enable quick track: add from Overview or Companies without a confirmation dialog"
                    }
                  />
                </div>
                {quickTrackError && (
                  <div className="mt-3">
                    <InlineError
                      message={quickTrackError}
                      onRetry={() => setQuickTrackError(null)}
                    />
                  </div>
                )}
              </div>
            </div>
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
