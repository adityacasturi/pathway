import type { CSSProperties } from "react";

/** Shared shell dimensions — keep in sync with AppShell inline styles. */
export const APP_SIDEBAR_WIDTH = "18.5rem";
export const APP_TOPBAR_HEIGHT = "4rem";

export const APP_SHELL_CSS_VARS = {
  "--app-sidebar-width": APP_SIDEBAR_WIDTH,
  "--app-topbar-height": APP_TOPBAR_HEIGHT,
} as CSSProperties;
