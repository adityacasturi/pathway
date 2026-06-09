"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatOpeningCount } from "@/components/companies/company-card";
import { CompanyLogo } from "@/components/company-logo";
import { ChatInsetCard } from "@/components/chat/chat-panel";
import { IndustryIcon } from "@/components/stats/industry-icon";
import type { ChatCompanyCardResult } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function CompanyCardBlock({ result }: { result: ChatCompanyCardResult }) {
  const { company, openingsHref } = result;

  return (
    <ChatInsetCard className="p-0">
      <Link
        href={openingsHref}
        className={cn(
          "group flex items-center gap-3 px-4 py-3 transition-colors",
          "hover:bg-[color-mix(in_oklab,var(--primary)_4%,var(--card))]",
        )}
      >
        <CompanyLogo
          company={company.name}
          companySlug={company.slug}
          websiteUrl={company.websiteUrl}
          size={44}
          lazy
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
          {company.industryLabel ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {company.industrySlug ? (
                <IndustryIcon slug={company.industrySlug} className="!size-3.5 shrink-0" />
              ) : null}
              <span className="truncate">{company.industryLabel}</span>
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium tabular-nums text-foreground">
            {formatOpeningCount(company.openCount)}
          </p>
          <p className="mt-0.5 flex items-center justify-end gap-0.5 text-[11px] font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
            View in Openings
            <ArrowUpRight size={12} aria-hidden />
          </p>
        </div>
      </Link>
    </ChatInsetCard>
  );
}
