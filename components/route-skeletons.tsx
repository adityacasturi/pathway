import { ContentAreaSpinner } from "@/components/app-shell/content-area-spinner";

/**
 * Route-level loading states for app/<route>/loading.tsx. Each route uses the
 * shared content-area spinner so navigation and streaming loads feel consistent
 * with the client-side NavigationPendingOverlay.
 */

function PageLoadingSpinner({ label = "Loading" }: { label?: string }) {
  return <ContentAreaSpinner label={label} />;
}

export function DashboardSkeleton() {
  return <PageLoadingSpinner label="Loading applications" />;
}

export function SettingsSkeleton() {
  return <PageLoadingSpinner label="Loading settings" />;
}

export function CompaniesSkeleton() {
  return <PageLoadingSpinner label="Loading companies" />;
}

export function LiveSkeleton() {
  return <PageLoadingSpinner label="Loading openings" />;
}

export function AlertsSkeleton() {
  return <PageLoadingSpinner label="Loading alerts" />;
}

export function HomeSkeleton() {
  return <PageLoadingSpinner label="Loading home" />;
}
