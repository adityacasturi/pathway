import { redirect } from "next/navigation";
import { TerminalLandingPage } from "@/components/landing/terminal-landing-page";
import { loadLandingTerminalSnapshot } from "@/lib/landing/terminal-data";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/metadata/page";

export const dynamic = "force-dynamic";

const landingDescription =
  "Track internship applications, browse openings, and get alerts for new roles.";

export const metadata = {
  ...pageMetadata("Pathway", landingDescription),
  title: { absolute: "Pathway" },
};

export default async function LandingRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/home");

  const snapshot = await loadLandingTerminalSnapshot();

  return <TerminalLandingPage snapshot={snapshot} />;
}
