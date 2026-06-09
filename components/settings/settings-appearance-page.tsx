"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { SettingsGroup } from "@/components/settings/settings-group";
import { saveAccentColorPreference } from "@/components/accent-theme-provider";
import { InlineError } from "@/components/ui/inline-error";
import { updateAccentColor } from "@/lib/actions/settings";
import { ACCENT_OPTIONS, type AccentColor } from "@/lib/config/accent";
import { cn } from "@/lib/utils";

interface Props {
  accentColor: AccentColor;
}

function SettingsError({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  if (!message) return null;
  return (
    <div className="px-5 pb-4">
      <InlineError message={message} onRetry={onRetry} />
    </div>
  );
}

export function SettingsAppearancePage({ accentColor }: Props) {
  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(accentColor);
  const [savedAccent, setSavedAccent] = useState<AccentColor>(accentColor);
  const [, startAccentTransition] = useTransition();
  const [accentError, setAccentError] = useState<string | null>(null);

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
      toast.success("Accent color updated");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsGroup title="Accent color" description="Accent color for buttons, links, and highlights.">
        <div className="px-5 py-4">
          <div
            role="radiogroup"
            aria-label="Accent color"
            className="flex flex-wrap gap-2"
          >
            {ACCENT_OPTIONS.map((option) => {
              const selected = selectedAccent === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onAccentSelect(option.id)}
                  className={cn(
                    "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
                    selected
                      ? "border-[var(--selection-border)] bg-[var(--selection-bg)] text-[var(--selection-fg)]"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span
                    className="size-3.5 shrink-0 rounded-full border border-black/10"
                    style={{ background: option.swatch }}
                    aria-hidden
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <SettingsError message={accentError} onRetry={() => setAccentError(null)} />
      </SettingsGroup>
    </div>
  );
}
