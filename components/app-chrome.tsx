"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

/**
 * Thin client wrapper so the root layout can keep the persistent app chrome
 * (top-center nav pill) mounted continuously, while still hiding it on auth
 * routes where there are no pages to switch to.
 *
 * Keeping this in the layout (instead of in each page) is what makes the pill
 * truly persistent — it never unmounts on route changes, so it doesn't flicker
 * during the old-page -> loading.tsx -> new-page handoff.
 */

const HIDDEN_PATHS = new Set(["/", "/login", "/set-password"]);

export function AppChrome() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.has(pathname)) return null;
  return <Sidebar />;
}
