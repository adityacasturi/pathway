"use client";

import { useEffect, useMemo, type ComponentProps } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { AlertsBundlesList } from "@/components/alerts/alerts-sectors-rail";
import type { AlertCompanyOption, CuratedSectorView } from "@/components/alerts/types";
import { SearchInput } from "@/components/search-input";
import { SectorLogoStack } from "@/components/sector-logo-stack";
import { cn } from "@/lib/utils";

export function AlertsAddSidebar({
  query,
  onQueryChange,
  addableCompanies,
  bundleSectors,
  followedSectorSlugs,
  pendingSectorSlug,
  pendingCompanyId,
  disabled,
  onAddCompany,
  onToggleSector,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  addableCompanies: AlertCompanyOption[];
  bundleSectors: CuratedSectorView[];
  followedSectorSlugs: Set<string>;
  pendingSectorSlug: string | null;
  pendingCompanyId: string | null;
  disabled: boolean;
  onAddCompany: (companyId: string) => void;
  onToggleSector: (slug: string) => void;
  className?: string;
}) {
  const trimmedQuery = query.trim();
  const showCompanies = addableCompanies.length > 0;
  const groupedBundles = useMemo(() => groupBundleSectors(bundleSectors), [bundleSectors]);

  return (
    <aside
      className={cn(
        "flex min-h-0 w-[min(34rem,100%)] shrink-0 flex-col border-l border-border bg-card px-8",
        className,
      )}
    >
      <div className="shrink-0 pb-2 pt-5">
        <h2 className="text-base font-semibold text-foreground">Add alert</h2>
        <div className="mt-4 [&_input]:h-8 [&_input]:rounded-md [&_input]:text-sm">
          <SearchInput
            value={query}
            onChange={onQueryChange}
            placeholder="Search companies or bundles…"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {showCompanies ? (
          <section>
            <SectionHeader label="Companies" />
            <ul className="divide-y divide-border/60">
              {addableCompanies.map((company) => (
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
        ) : null}

        <section className="pb-5">
          <SectionHeader label="Bundles" />
          {groupedBundles.length > 0 ? (
            groupedBundles.length === 1 && groupedBundles[0]?.label === "Industry bundles" ? (
              <AlertsBundlesList
                sectors={groupedBundles[0].sectors}
                followedSectorSlugs={followedSectorSlugs}
                pendingSectorSlug={pendingSectorSlug}
                disabled={disabled}
                onToggleSector={onToggleSector}
              />
            ) : (
              <div className="space-y-6">
                {groupedBundles.map((group) => (
                  <section key={group.label}>
                    <SectionHeader
                      label={group.label}
                      className="border-t border-border/60 pb-2 pt-4 first:border-t-0 first:pt-0"
                    />
                    <AlertsBundlesList
                      sectors={group.sectors}
                      followedSectorSlugs={followedSectorSlugs}
                      pendingSectorSlug={pendingSectorSlug}
                      disabled={disabled}
                      onToggleSector={onToggleSector}
                    />
                  </section>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              {trimmedQuery ? "No bundles match your search." : "No bundles available."}
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}

export function AlertsAddSidebarOverlay({
  open,
  onClose,
  ...props
}: {
  open: boolean;
  onClose: () => void;
} & ComponentProps<typeof AlertsAddSidebar>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--app-topbar-height)] z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="Add alert"
    >
      <button
        type="button"
        aria-label="Close add panel"
        className="ds-overlay-enter absolute inset-0 bg-background/20 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div className="ds-drawer-enter absolute inset-y-0 right-0 flex max-w-full">
        <AlertsAddSidebar
          {...props}
          className="relative z-10 h-full w-[min(34rem,calc(100vw-1rem))] shadow-[-16px_0_48px_-20px_color-mix(in_oklab,var(--ink)_22%,transparent)]"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
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

function SectionHeader({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("pb-2 pt-2", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
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
    <div className="flex items-center gap-4 py-3">
      <SectorLogoStack
        companies={[
          { slug: company.slug, name: company.name, websiteUrl: company.websiteUrl },
        ]}
      />
      <div className="min-w-0 flex-1 pl-0.5">
        <p className="truncate text-sm font-medium text-foreground">{company.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{company.industryLabel}</p>
      </div>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={onAdd}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Plus size={13} strokeWidth={2} />
        )}
        Add alert
      </button>
    </div>
  );
}
