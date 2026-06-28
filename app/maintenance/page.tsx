import { MaintenanceScreen } from "@/components/maintenance/maintenance-screen";
import { pageMetadata } from "@/lib/metadata/page";

export const metadata = {
  ...pageMetadata("Maintenance", "Pathway is temporarily offline for scheduled maintenance."),
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return <MaintenanceScreen />;
}
