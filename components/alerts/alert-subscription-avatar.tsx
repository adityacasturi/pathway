"use client";

import type { AlertSubscriptionView } from "@/components/alerts/types";
import { SectorLogoStack } from "@/components/sector-logo-stack";

export function AlertSubscriptionAvatar({
  subscription,
  className,
}: {
  subscription: AlertSubscriptionView;
  className?: string;
}) {
  if (subscription.type === "company") {
    return (
      <SectorLogoStack
        className={className}
        companies={[
          {
            slug: subscription.companySlug ?? subscription.label,
            name: subscription.label,
            websiteUrl: subscription.websiteUrl,
          },
        ]}
      />
    );
  }

  return <SectorLogoStack className={className} companies={subscription.sectorCompanies ?? []} />;
}
