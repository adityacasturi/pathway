const NAV_HREFS = [
  "/home",
  "/applications",
  "/live",
  "/discover",
  "/alerts",
  "/stats",
  "/settings",
] as const;

export type NavHref = (typeof NAV_HREFS)[number];

/** User-facing nav and page titles (routes unchanged). */
export const NAV_LABELS: Record<NavHref, string> = {
  "/home": "Overview",
  "/applications": "Applications",
  "/live": "Openings",
  "/discover": "Companies",
  "/alerts": "Alerts",
  "/stats": "Insights",
  "/settings": "Settings",
};

export function getPageLabel(href: NavHref): string {
  return NAV_LABELS[href];
}

export function getActiveNavHref(pathname: string): NavHref {
  if (pathname === "/home") return "/home";
  return NAV_HREFS.find((href) => href !== "/home" && pathname.startsWith(href)) ?? "/home";
}

export function isActiveNavHref(pathname: string, href: NavHref) {
  return getActiveNavHref(pathname) === href;
}
