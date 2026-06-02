"use client";

import { CompanyLogo } from "@/components/company-logo";
import {
  MARKET_WEEK_LIST_HEADER_CLASS,
  MARKET_WEEK_LIST_ROW_CLASS,
} from "@/components/stats/market-week-list";
import type { HotCompany } from "@/lib/home/briefing";

interface Props {
  companies: HotCompany[];
}

export function HotCompaniesList({ companies }: Props) {
  const roleTotal = companies.reduce((sum, company) => sum + company.newCount, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className={MARKET_WEEK_LIST_HEADER_CLASS}>
        <h3 className="text-[14px] font-medium text-foreground">Most active companies</h3>
        <span className="label-meta shrink-0 tabular">{roleTotal} roles</span>
      </div>

      {companies.length === 0 ? (
        <p className="px-3.5 py-4 text-[13px] text-muted-foreground sm:px-4">Nothing this week.</p>
      ) : (
        <ul className="divide-y divide-border">
          {companies.map((company) => (
            <li key={company.slug} className={MARKET_WEEK_LIST_ROW_CLASS}>
              <span className="flex min-w-0 items-center gap-2">
                <CompanyLogo
                  company={company.name}
                  companySlug={company.slug}
                  websiteUrl={company.websiteUrl}
                  size={20}
                />
                <span className="truncate text-[13px] text-foreground">{company.name}</span>
              </span>
              <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
                {company.newCount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
