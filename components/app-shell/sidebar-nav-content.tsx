"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Home, LayoutGrid, Mail, Radio, Settings } from "lucide-react";
import { SidebarAccount } from "@/components/app-shell/sidebar-account";
import { SidebarItem, SidebarSectionLabel } from "@/components/design-system/sidebar-item";
import { useDisplayNavHref } from "@/components/app-shell/navigation-pending";
import {
  getPageLabel,
  isActiveNavHref,
  NAV_SECTIONS,
  type NavHref,
} from "@/lib/config/nav";

const NAV_ICONS: Record<NavHref, typeof Home> = {
  "/home": Home,
  "/applications": LayoutGrid,
  "/openings": Radio,
  "/companies": Compass,
  "/alerts": Mail,
  "/settings": Settings,
};

const NAV_LINK_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({
    href: item.href,
    label: getPageLabel(item.href),
    icon: NAV_ICONS[item.href],
  })),
);

export function SidebarNavContent({
  userEmail,
  onNavigate,
}: {
  userEmail: string | null;
  onNavigate?: () => void;
}) {
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
    <>
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-5">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.label}>
            <SidebarSectionLabel first={sectionIndex === 0}>{section.label}</SidebarSectionLabel>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  label={getPageLabel(item.href)}
                  icon={NAV_ICONS[item.href]}
                  active={activeNavHref === item.href}
                  onClick={(event) => {
                    if (isActiveNavHref(pathname, item.href)) {
                      event.preventDefault();
                      onNavigate?.();
                      return;
                    }
                    router.prefetch(item.href);
                    onNavigate?.();
                  }}
                  onPointerEnter={() => router.prefetch(item.href)}
                  onFocus={() => router.prefetch(item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <SidebarAccount userEmail={userEmail} />
    </>
  );
}
