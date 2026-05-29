const NAV_HREFS = ["/home", "/applications", "/discover", "/stats", "/settings"] as const;

export type NavHref = (typeof NAV_HREFS)[number];

export function getActiveNavHref(pathname: string): NavHref {
  if (pathname === "/home") return "/home";
  return NAV_HREFS.find((href) => href !== "/home" && pathname.startsWith(href)) ?? "/home";
}

export function isActiveNavHref(pathname: string, href: NavHref) {
  return getActiveNavHref(pathname) === href;
}
