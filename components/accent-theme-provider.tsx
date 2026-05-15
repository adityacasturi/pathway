"use client";

import type { AccentColor } from "@/lib/config/accent";

/**
 * Imperatively swap the accent on the live DOM so the settings UI gets
 * instant feedback while the server action persists the change. The
 * canonical accent for any new page load comes from the server layout
 * (DB for authenticated users, midnight for everyone else).
 */
export function saveAccentColorPreference(accent: AccentColor) {
  document.documentElement.dataset.accent = accent;
}
