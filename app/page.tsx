import { redirect } from "next/navigation";
import { MarketingLanding } from "@/components/landing/marketing/marketing-landing";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/metadata/page";
import { loadLandingOpeningPreview } from "@/lib/landing/openings-preview-data";

export const dynamic = "force-dynamic";

const landingDescription =
  "Track internship applications, browse openings, and get alerts for new roles.";

export const metadata = {
  ...pageMetadata("Pathway", landingDescription),
  title: { absolute: "Pathway" },
};

export default async function LandingRoute() {
  const supabase = await createClient();
  const userResult = await supabase.auth.getUser();

  if (userResult.data.user) redirect("/home");

  const openingsPreview = await loadLandingOpeningPreview();

  return <MarketingLanding openingsPreview={openingsPreview} />;
}
