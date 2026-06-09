import { SCOUT_ENABLED, SCOUT_LOCKED_COPY } from "@/lib/config/scout";

export type NavHref =
  | "/home"
  | "/applications"
  | "/openings"
  | "/companies"
  | "/alerts"
  | "/chat"
  | "/settings";

export type NavLockedId =
  | "jarvis"
  | "draft"
  | "scout"
  | "forums"
  | "alpha"
  | "guides"
  | "practice";

export type NavSectionItem =
  | { kind: "link"; href: NavHref }
  | { kind: "locked"; id: NavLockedId; label: string; hint: string; description: string };

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
  {
    label: "Intelligence",
    items: [
      SCOUT_ENABLED
        ? { kind: "link", href: "/chat" }
        : {
            kind: "locked",
            id: "scout",
            label: SCOUT_LOCKED_COPY.label,
            hint: SCOUT_LOCKED_COPY.hint,
            description: SCOUT_LOCKED_COPY.description,
          },
      {
        kind: "locked",
        id: "jarvis",
        label: "Jarvis",
        hint: "Auto-apply agent",
        description:
          "Autonomously applies to roles for you by filling forms and using your profile details.",
      },
      {
        kind: "locked",
        id: "draft",
        label: "Resumes",
        hint: "Auto-tailored resumes",
        description:
          "Auto-tailor your resumes to specific roles, companies, and job descriptions.",
      },
    ],
  },
  {
    label: "Social",
    items: [
      {
        kind: "locked",
        id: "forums",
        label: "Forums",
        hint: "Student community",
        description:
          "Talk with other Pathway users about roles, recruiting, applications, and internship life.",
      },
      {
        kind: "locked",
        id: "alpha",
        label: "Intel",
        hint: "Interview intel",
        description:
          "Shared interview advice, process notes, and company-specific prep from other students.",
      },
    ],
  },
  {
    label: "Prep",
    items: [
      {
        kind: "locked",
        id: "guides",
        label: "Guides",
        hint: "Internship 101s",
        description:
          "Practical guides for landing internships, doing well on the job, and exploring industries.",
      },
      {
        kind: "locked",
        id: "practice",
        label: "Practice",
        hint: "Technical prep",
        description:
          "Practice LeetCode-style problems, technical screens, and role-specific interview drills.",
      },
    ],
  },
  { label: "Account", items: [{ kind: "link", href: "/settings" }] },
];

export const NAV_HREFS = NAV_SECTIONS.flatMap((section) =>
  section.items.flatMap((item) => (item.kind === "link" ? [item.href] : [])),
) as NavHref[];

export const NAV_LABELS: Record<NavHref, string> = {
  "/home": "Home",
  "/chat": "Scout",
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
