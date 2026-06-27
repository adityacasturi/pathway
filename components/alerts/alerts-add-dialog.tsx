"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AlertsBundlesList } from "@/components/alerts/alerts-sectors-rail";
import {
  ADD_ALERT_ROW_PENDING_CLASS,
  addAlertPillButtonClass,
} from "@/components/alerts/add-alert-button-styles";
import type { AlertCompanyOption, CuratedSectorView } from "@/components/alerts/types";
import { SearchInput } from "@/components/search-input";
import { SectorLogoStack } from "@/components/sector-logo-stack";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SegmentedTabs } from "@/components/ui/tabs";
import { partitionIndustrySectorsForAddDialog } from "@/lib/alerts/addable-targets";
import { cn } from "@/lib/utils";

type AddAlertTab = "companies" | "bundles";

export function AlertsAddDialog({
  open,
  onOpenChange,
  query,
  onQueryChange,
  addableCompanies,
  popularCompanies,
  bundleSectors,
  followedSectorSlugs,
  pendingSectorSlug,
  pendingCompanyId,
  disabled,
  onAddCompany,
  onToggleSector,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (value: string) => void;
  addableCompanies: AlertCompanyOption[];
  popularCompanies: AlertCompanyOption[];
  bundleSectors: CuratedSectorView[];
  followedSectorSlugs: Set<string>;
  pendingSectorSlug: string | null;
  pendingCompanyId: string | null;
  disabled: boolean;
  onAddCompany: (companyId: string) => void;
  onToggleSector: (slug: string) => void;
}) {
  const [tab, setTab] = useState<AddAlertTab>("companies");
  const isSearching = query.trim().length > 0;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTab("companies");
    }
    onOpenChange(nextOpen);
  };

  const companyRows = isSearching ? addableCompanies : popularCompanies;
  const searchPlaceholder =
    tab === "companies" ? "Search companies…" : "Search industries…";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(40rem,88dvh)] max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="shrink-0 space-y-4 border-b border-border px-6 pb-5 pt-6">
          <DialogHeader className="gap-2.5 pr-8">
            <DialogTitle className="text-xl font-semibold tracking-tight">Add alert</DialogTitle>
            <p className="text-sm font-normal leading-relaxed text-muted-foreground">
              Follow a company or industry to get email when matching roles are posted.
            </p>
          </DialogHeader>

          <SegmentedTabs
            value={tab}
            options={[
              { value: "companies", label: "Companies" },
              { value: "bundles", label: "Industries" },
            ]}
            onChange={setTab}
          />

          <div className="[&_input]:h-8 [&_input]:rounded-md [&_input]:text-sm">
            <SearchInput value={query} onChange={onQueryChange} placeholder={searchPlaceholder} />
          </div>
        </div>

        <div className="min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-width:thin]">
          {tab === "companies" ? (
            <CompaniesPanel
              isSearching={isSearching}
              companies={companyRows}
              pendingCompanyId={pendingCompanyId}
              disabled={disabled}
              onAddCompany={onAddCompany}
            />
          ) : (
            <BundlesPanel
              sectors={bundleSectors}
              isSearching={isSearching}
              followedSectorSlugs={followedSectorSlugs}
              pendingSectorSlug={pendingSectorSlug}
              disabled={disabled}
              onToggleSector={onToggleSector}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompaniesPanel({
  isSearching,
  companies,
  pendingCompanyId,
  disabled,
  onAddCompany,
}: {
  isSearching: boolean;
  companies: AlertCompanyOption[];
  pendingCompanyId: string | null;
  disabled: boolean;
  onAddCompany: (companyId: string) => void;
}) {
  if (companies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {isSearching
          ? "No companies match your search."
          : "Search for a company, or check Industries for groups like FAANG+."}
      </p>
    );
  }

  return (
    <section>
      {!isSearching ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Popular
        </p>
      ) : null}
      <ul className="divide-y divide-border/60">
        {companies.map((company) => (
          <li key={company.id}>
            <AddCompanyRow
              company={company}
              pending={pendingCompanyId === company.id}
              disabled={disabled}
              onAdd={() => onAddCompany(company.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BundlesPanel({
  sectors,
  isSearching,
  followedSectorSlugs,
  pendingSectorSlug,
  disabled,
  onToggleSector,
}: {
  sectors: CuratedSectorView[];
  isSearching: boolean;
  followedSectorSlugs: Set<string>;
  pendingSectorSlug: string | null;
  disabled: boolean;
  onToggleSector: (slug: string) => void;
}) {
  const { featured, remaining } = partitionIndustrySectorsForAddDialog(
    sectors,
    isSearching ? new Set<string>() : followedSectorSlugs,
  );
  const groupedRemaining = groupBundleSectors(isSearching ? sectors : remaining);

  if (sectors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {isSearching ? "No industries match your search." : "No industries available."}
      </p>
    );
  }

  if (isSearching) {
    return (
      <AlertsBundlesList
        sectors={sectors}
        followedSectorSlugs={followedSectorSlugs}
        pendingSectorSlug={pendingSectorSlug}
        disabled={disabled}
        onToggleSector={onToggleSector}
      />
    );
  }

  return (
    <div className="space-y-5">
      {featured.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Popular
          </p>
          <AlertsBundlesList
            sectors={featured}
            followedSectorSlugs={followedSectorSlugs}
            pendingSectorSlug={pendingSectorSlug}
            disabled={disabled}
            onToggleSector={onToggleSector}
          />
        </section>
      ) : null}

      {groupedRemaining.length === 1 && groupedRemaining[0]?.label === "Industry bundles" ? (
        <section>
          {featured.length > 0 ? (
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              More industries
            </p>
          ) : null}
          <AlertsBundlesList
            sectors={groupedRemaining[0].sectors}
            followedSectorSlugs={followedSectorSlugs}
            pendingSectorSlug={pendingSectorSlug}
            disabled={disabled}
            onToggleSector={onToggleSector}
          />
        </section>
      ) : (
        groupedRemaining.map((group) => (
          <section key={group.label}>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <AlertsBundlesList
              sectors={group.sectors}
              followedSectorSlugs={followedSectorSlugs}
              pendingSectorSlug={pendingSectorSlug}
              disabled={disabled}
              onToggleSector={onToggleSector}
            />
          </section>
        ))
      )}
    </div>
  );
}

function AddCompanyRow({
  company,
  pending,
  disabled,
  onAdd,
}: {
  company: AlertCompanyOption;
  pending: boolean;
  disabled: boolean;
  onAdd: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-2 py-3 transition-colors", pending && ADD_ALERT_ROW_PENDING_CLASS)}>
      <SectorLogoStack
        companies={[{ slug: company.slug, name: company.name, websiteUrl: company.websiteUrl }]}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{company.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{company.industryLabel}</p>
      </div>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={onAdd}
        aria-busy={pending}
        aria-label={pending ? `Adding ${company.name}…` : `Add alert for ${company.name}`}
        className={addAlertPillButtonClass(pending)}
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Plus size={13} strokeWidth={2} />
        )}
        <span>Add</span>
      </button>
    </div>
  );
}

function groupBundleSectors(sectors: CuratedSectorView[]) {
  const groups = new Map<
    string,
    { label: string; sortOrder: number; sectors: CuratedSectorView[] }
  >();

  for (const sector of sectors) {
    const label = sector.groupLabel || "Industry bundles";
    const current = groups.get(label);
    if (current) {
      current.sectors.push(sector);
      current.sortOrder = Math.min(current.sortOrder, sector.groupSortOrder);
      continue;
    }

    groups.set(label, {
      label,
      sortOrder: sector.groupSortOrder,
      sectors: [sector],
    });
  }

  return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}
