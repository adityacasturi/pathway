"use client";

import { useEffect } from "react";
import {
  DEFAULT_ACCENT_COLOR,
  isAccentColor,
  resolveAccentColor,
  type AccentColor,
} from "@/lib/config/accent";

const STORAGE_KEY = "pathway-accent-color";
const ACCENT_CHANGE_EVENT = "pathway:accent-color";

function applyAccentColor(accent: AccentColor) {
  document.documentElement.dataset.accent = accent;
}

export function saveAccentColorPreference(accent: AccentColor) {
  localStorage.setItem(STORAGE_KEY, accent);
  applyAccentColor(accent);
  window.dispatchEvent(new CustomEvent(ACCENT_CHANGE_EVENT, { detail: accent }));
}

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const resolved = resolveAccentColor(stored);
    applyAccentColor(resolved);
    if (stored !== resolved) localStorage.setItem(STORAGE_KEY, resolved);

    function onAccentChange(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail : null;
      applyAccentColor(isAccentColor(detail) ? detail : DEFAULT_ACCENT_COLOR);
    }

    window.addEventListener(ACCENT_CHANGE_EVENT, onAccentChange);
    return () => window.removeEventListener(ACCENT_CHANGE_EVENT, onAccentChange);
  }, []);

  return children;
}
