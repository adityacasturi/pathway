"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Code2,
  Compass,
  Dog,
  FileText,
  Home,
  LayoutGrid,
  Lightbulb,
  Mail,
  MessageSquare,
  Radio,
  Settings,
  Wand2,
} from "lucide-react";
import { SidebarAccount } from "@/components/app-shell/sidebar-account";
import { SidebarItem, SidebarLockedItem, SidebarSectionLabel } from "@/components/design-system/sidebar-item";
import { useDisplayNavHref } from "@/components/app-shell/navigation-pending";
import {
  getPageLabel,
  isActiveNavHref,
  NAV_SECTIONS,
  type NavHref,
  type NavLockedId,
} from "@/lib/config/nav";

const NAV_ICONS: Record<NavHref, typeof Home> = {
  "/home": Home,
  "/applications": LayoutGrid,
  "/openings": Radio,
  "/companies": Compass,
  "/alerts": Mail,
  "/chat": Wand2,
  "/settings": Settings,
};

const LOCKED_ICONS: Record<NavLockedId, typeof FileText> = {
  jarvis: Wand2,
  draft: FileText,
  scout: Dog,
  forums: MessageSquare,
  alpha: Lightbulb,
  guides: BookOpen,
  practice: Code2,
};

const NAV_LINK_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.flatMap((item) =>
    item.kind === "link"
      ? [{ href: item.href, label: getPageLabel(item.href), icon: NAV_ICONS[item.href] }]
      : [],
  ),
);

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeNavHref = useDisplayNavHref();

  useEffect(() => {
    const prefetchAll = () => {
      for (const item of NAV_LINK_ITEMS) {
        if (item.href !== pathname) router.prefetch(item.href);
      }
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetchAll, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = globalThis.setTimeout(prefetchAll, 250);
    return () => globalThis.clearTimeout(t);
  }, [pathname, router]);

  return (
    <aside
      className="app-sidebar fixed inset-y-0 left-0 z-[45] hidden w-[var(--app-sidebar-width)] flex-col border-r border-border bg-[var(--shell-sidebar)] pt-[var(--app-topbar-height)] font-sans antialiased md:flex"
      aria-label="Application"
    >
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-5">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.label}>
            <SidebarSectionLabel first={sectionIndex === 0}>{section.label}</SidebarSectionLabel>
            <div className="space-y-0.5">
              {section.items.map((item) =>
                item.kind === "link" ? (
                  <SidebarItem
                    key={item.href}
                    href={item.href}
                    label={getPageLabel(item.href)}
                    icon={NAV_ICONS[item.href]}
                    active={activeNavHref === item.href}
                    onClick={(event) => {
                      if (isActiveNavHref(pathname, item.href)) {
                        event.preventDefault();
                        return;
                      }
                      router.prefetch(item.href);
                    }}
                    onPointerEnter={() => router.prefetch(item.href)}
                    onFocus={() => router.prefetch(item.href)}
                  />
                ) : (
                  <SidebarLockedItem
                    key={item.id}
                    label={item.label}
                    hint={item.hint}
                    description={item.description}
                    icon={LOCKED_ICONS[item.id]}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      <SidebarAccount userEmail={userEmail} />
    </aside>
  );
}
