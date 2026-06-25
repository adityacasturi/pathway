export type NavHref =
  | "/home"
  | "/applications"
  | "/openings"
  | "/companies"
  | "/alerts"
  | "/settings";

export type NavSectionItem = { kind: "link"; href: NavHref };

export type NavSection = {
  label: string;
  items: readonly NavSectionItem[];
};

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: "Overview",
    items: [
      { kind: "link", href: "/home" },
      { kind: "link", href: "/applications" },
    ],
  },
  {
    label: "Explore",
    items: [
      { kind: "link", href: "/openings" },
      { kind: "link", href: "/companies" },
      { kind: "link", href: "/alerts" },
    ],
  },
  { label: "Account", items: [{ kind: "link", href: "/settings" }] },
];

export const NAV_HREFS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => item.href),
) as NavHref[];

export const NAV_LABELS: Record<NavHref, string> = {
  "/home": "Home",
  "/applications": "Applications",
  "/openings": "Openings",
  "/companies": "Companies",
  "/alerts": "Alerts",
  "/settings": "Settings",
};

export const DEFAULT_AUTH_HREF: NavHref = "/home";

export function getPageLabel(href: NavHref): string {
  return NAV_LABELS[href];
}

export function getActiveNavHref(pathname: string): NavHref {
  return NAV_HREFS.find((href) => pathname.startsWith(href)) ?? DEFAULT_AUTH_HREF;
}

export function isActiveNavHref(pathname: string, href: NavHref) {
  return getActiveNavHref(pathname) === href;
}
