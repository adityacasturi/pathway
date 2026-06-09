"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarItem } from "@/components/design-system/sidebar-item";
import {
  SETTINGS_NAV_ITEMS,
  type SettingsHref,
} from "@/lib/config/settings-nav";
import { cn } from "@/lib/utils";

export function SettingsSidebar({
  activeSection,
  onSectionChange,
  className,
}: {
  activeSection: SettingsHref;
  onSectionChange?: (href: SettingsHref) => void;
  className?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    for (const item of SETTINGS_NAV_ITEMS) {
      router.prefetch(item.href);
    }
  }, [router]);

  function onNavigate(href: SettingsHref) {
    if (href === activeSection) return;
    onSectionChange?.(href);
    router.replace(href, { scroll: false });
  }

  return (
    <nav
      aria-label="Settings sections"
      className={cn("flex h-full min-h-0 flex-col px-5 py-5", className)}
    >
      <ul className="flex flex-row gap-1 md:flex-col">
        {SETTINGS_NAV_ITEMS.map((item) => {
          const active = activeSection === item.href;
          return (
            <li key={item.href} className="min-w-0 flex-1 md:flex-none">
              <SidebarItem
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={active}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.href);
                }}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
