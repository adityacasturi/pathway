"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SettingsAccountPage } from "@/components/settings/settings-account-page";
import { SettingsAppearancePage } from "@/components/settings/settings-appearance-page";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { PageShell } from "@/components/design-system/page";
import type { AccentColor } from "@/lib/config/accent";
import { getActiveSettingsHref } from "@/lib/config/settings-nav";

interface Props {
  userEmail: string | null;
  accentColor: AccentColor;
  children: ReactNode;
}

export function SettingsShell({
  userEmail,
  accentColor,
  children,
}: Props) {
  const pathname = usePathname();
  const activeSection = getActiveSettingsHref(pathname);

  return (
    <PageShell className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-border bg-background md:w-64 md:border-b-0 md:border-r">
          <SettingsSidebar activeSection={activeSection} />
        </aside>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-none px-6 py-5">
          <div className="mx-auto w-full max-w-3xl">
            {activeSection === "/settings/account" ? (
              <SettingsAccountPage userEmail={userEmail} />
            ) : (
              <SettingsAppearancePage accentColor={accentColor} />
            )}
          </div>
        </main>
      </div>
      <div hidden aria-hidden>
        {children}
      </div>
    </PageShell>
  );
}
