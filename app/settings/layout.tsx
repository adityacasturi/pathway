import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata/page";

export const metadata: Metadata = pageMetadata("Settings", "Account and appearance preferences.");
import { SettingsShell } from "@/components/settings/settings-shell";
import { loadAppearancePreferences } from "@/lib/settings/load-appearance-preferences";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/settings");

  const appearance = await loadAppearancePreferences(supabase, user.id);

  return (
    <SettingsShell
      userEmail={user.email ?? null}
      accentColor={appearance.accentColor}
    >
      {children}
    </SettingsShell>
  );
}
