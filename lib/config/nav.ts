const NAV_HREFS = [
  "/home",
  "/applications",
  "/openings",
  "/companies",
  "/alerts",
  "/insights",
  "/settings",
] as const;

export type NavHref = (typeof NAV_HREFS)[number];

export const NAV_LABELS: Record<NavHref, string> = {
  "/home": "Overview",
  "/applications": "Applications",
  "/openings": "Openings",
  "/companies": "Companies",
  "/alerts": "Alerts",
  "/insights": "Insights",
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
