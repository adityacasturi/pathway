import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsPage } from "@/components/settings-page";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const supabase = await createClient();
  const userResult = await supabase.auth.getUser();

  const { data } = userResult;
  if (!data.user) redirect("/login");

  return <SettingsPage userEmail={data.user.email ?? null} />;
}
