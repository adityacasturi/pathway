"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertsAddSidebarOverlay } from "@/components/alerts/alerts-add-sidebar";
import { AlertsFilterBar } from "@/components/alerts/alerts-filter-bar";
import { AlertsSubscriptionList } from "@/components/alerts/alerts-subscription-list";
import type {
  AlertCompanyOption,
  AlertSubscriptionView,
  CuratedSectorView,
} from "@/components/alerts/types";
import { PageShell } from "@/components/design-system/page";
import { InlineError } from "@/components/ui/inline-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addCompanyAlert,
  addSectorAlert,
  removeCompanyAlert,
  removeSectorAlert,
  setAlertSubscriptionPaused,
  updateAlertGlobalFilters,
} from "@/lib/actions/alerts";
import { filterAddableCompanies, filterSectorsByQuery } from "@/lib/alerts/addable-targets";
import {
  alertFiltersToView,
  viewToAlertFilters,
  type AlertFilters,
  type AlertFiltersView,
} from "@/lib/alerts/filters";
import { sortAlertSubscriptions } from "@/lib/alerts/subscription-sort";
import { useFocusSearchShortcut } from "@/lib/ui/focus-search-shortcut";
import { getSearchTerms } from "@/lib/search-terms";

interface Props {
  globalFilters: AlertFilters;
  briefingEnabled: boolean;
  subscriptions: AlertSubscriptionView[];
  companies: AlertCompanyOption[];
  curatedSectors: CuratedSectorView[];
}

export function AlertsPage({
  globalFilters: initialGlobalFilters,
  briefingEnabled,
  subscriptions: initialSubscriptions,
  companies,
  curatedSectors,
}: Props) {
  const router = useRouter();
  const [subscriptionState, setSubscriptionState] = useState({
    source: initialSubscriptions,
    items: initialSubscriptions,
  });
  const subscriptions =
    subscriptionState.source === initialSubscriptions
      ? subscriptionState.items
      : initialSubscriptions;
  const setSubscriptions = (
    update:
      | AlertSubscriptionView[]
      | ((current: AlertSubscriptionView[]) => AlertSubscriptionView[]),
  ) => {
    setSubscriptionState((current) => {
      const currentItems =
        current.source === initialSubscriptions ? current.items : initialSubscriptions;
      return {
        source: initialSubscriptions,
        items: typeof update === "function" ? update(currentItems) : update,
      };
    });
  };
  const [query, setQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [pendingCompanyId, setPendingCompanyId] = useState<string | null>(null);
  const [pendingPauseId, setPendingPauseId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AlertSubscriptionView | null>(null);
  const [isActionPending, startActionTransition] = useTransition();
  const [globalFilterView, setGlobalFilterView] = useState<AlertFiltersView>(() =>
    alertFiltersToView(initialGlobalFilters),
  );
  const [savedGlobalFilterView, setSavedGlobalFilterView] = useState(globalFilterView);
  const [globalFiltersError, setGlobalFiltersError] = useState<string | null>(null);
  const [isGlobalFiltersPending, startGlobalFiltersTransition] = useTransition();
  const globalSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchInputRef = useRef<HTMLDivElement | null>(null);
  useFocusSearchShortcut(searchInputRef);

  useEffect(() => {
    return () => {
      if (globalSaveTimerRef.current) {
        clearTimeout(globalSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (JSON.stringify(globalFilterView) === JSON.stringify(savedGlobalFilterView)) {
      return;
    }

    if (globalSaveTimerRef.current) {
      clearTimeout(globalSaveTimerRef.current);
    }

    globalSaveTimerRef.current = setTimeout(() => {
      setGlobalFiltersError(null);
      startGlobalFiltersTransition(async () => {
        const result = await updateAlertGlobalFilters(globalFilterView);
        if (result?.error) {
          setGlobalFiltersError(result.error);
          setGlobalFilterView(savedGlobalFilterView);
          toast.error("Couldn't save alert defaults", { description: result.error });
          return;
        }
        setSavedGlobalFilterView(globalFilterView);
        toast.success("Alert defaults updated");
        router.refresh();
      });
    }, 400);

    return () => {
      if (globalSaveTimerRef.current) {
        clearTimeout(globalSaveTimerRef.current);
      }
    };
  }, [globalFilterView, router, savedGlobalFilterView]);

  const followedSectorSlugs = useMemo(
    () =>
      new Set(
        subscriptions.filter((sub) => sub.type === "sector").map((sub) => sub.sectorSlug ?? ""),
      ),
    [subscriptions],
  );

  const followedCompanyIds = useMemo(
    () =>
      new Set(
        subscriptions.filter((sub) => sub.type === "company").map((sub) => sub.companyId ?? ""),
      ),
    [subscriptions],
  );


  const filteredSubscriptions = useMemo(() => {
    const terms = getSearchTerms(query);
    const filtered = subscriptions.filter((sub) => {
      if (terms.length === 0) {
        return true;
      }
      const haystack = sub.label.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
    return sortAlertSubscriptions(filtered);
  }, [query, subscriptions]);

  const bundleSectors = useMemo(
    () => filterSectorsByQuery(curatedSectors, addQuery),
    [curatedSectors, addQuery],
  );

  const addableCompanies = useMemo(
    () => filterAddableCompanies(companies, followedCompanyIds, addQuery, "all"),
    [companies, followedCompanyIds, addQuery],
  );

  const activeGlobalFilters = useMemo(
    () => viewToAlertFilters(savedGlobalFilterView),
    [savedGlobalFilterView],
  );

  function toggleSector(slug: string) {
    setActionError(null);
    const existing = subscriptions.find((sub) => sub.type === "sector" && sub.sectorSlug === slug);
    const sector = curatedSectors.find((item) => item.slug === slug);
    const previous = subscriptions;

    if (existing) {
      setSubscriptions((current) => current.filter((sub) => sub.id !== existing.id));
    } else if (sector) {
      setSubscriptions((current) => [
        ...current,
        {
          id: `pending-sector-${slug}`,
          type: "sector",
          label: sector.label,
          companyId: null,
          companySlug: null,
          sectorSlug: slug,
          websiteUrl: null,
          sectorCompanies: sector.companies,
          filterOverride: null,
          paused: false,
        },
      ]);
    }

    setPendingSlug(slug);
    startActionTransition(async () => {
      const result = existing
        ? await removeSectorAlert(existing.id)
        : await addSectorAlert(slug);

      setPendingSlug(null);

      if (result?.error) {
        setActionError(result.error);
        setSubscriptions(previous);
        toast.error(existing ? "Couldn't remove bundle" : "Couldn't follow bundle", {
          description: result.error,
        });
        return;
      }

      toast.success(existing ? `Unfollowed ${sector?.label ?? "bundle"}` : `Now following ${sector?.label ?? "bundle"}`);
      router.refresh();
    });
  }

  function addCompany(companyId: string) {
    setActionError(null);
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;

    const previous = subscriptions;
    setSubscriptions((current) => [
      ...current,
      {
        id: `pending-company-${companyId}`,
        type: "company",
        label: company.name,
        companyId: company.id,
        companySlug: company.slug,
        sectorSlug: null,
        websiteUrl: company.websiteUrl,
        filterOverride: null,
        paused: false,
      },
    ]);

    setPendingCompanyId(companyId);
    startActionTransition(async () => {
      const result = await addCompanyAlert(companyId);
      setPendingCompanyId(null);

      if (result?.error) {
        setActionError(result.error);
        setSubscriptions(previous);
        toast.error("Couldn't follow company", { description: result.error });
        return;
      }

      toast.success(`Now following ${company.name}`);
      router.refresh();
    });
  }

  function requestRemoveSubscription(subscription: AlertSubscriptionView) {
    setRemoveTarget(subscription);
  }

  function removeSubscription(subscription: AlertSubscriptionView) {
    setActionError(null);
    const previous = subscriptions;
    setSubscriptions((current) => current.filter((sub) => sub.id !== subscription.id));
    setPendingRemoveId(subscription.id);
    startActionTransition(async () => {
      const result =
        subscription.type === "company"
          ? await removeCompanyAlert(subscription.id)
          : await removeSectorAlert(subscription.id);
      setPendingRemoveId(null);

      if (result?.error) {
        setActionError(result.error);
        setSubscriptions(previous);
        toast.error("Couldn't remove alert", { description: result.error });
        return;
      }

      toast.success(`Removed ${subscription.label}`);
      router.refresh();
    });
  }

  function toggleSubscriptionPaused(subscriptionId: string, paused: boolean) {
    setActionError(null);
    const previous = subscriptions;
    const subscription = subscriptions.find((sub) => sub.id === subscriptionId);
    setSubscriptions((current) =>
      current.map((sub) => (sub.id === subscriptionId ? { ...sub, paused } : sub)),
    );
    setPendingPauseId(subscriptionId);
    startActionTransition(async () => {
      const result = await setAlertSubscriptionPaused(subscriptionId, paused);
      setPendingPauseId(null);

      if (result?.error) {
        setActionError(result.error);
        setSubscriptions(previous);
        toast.error(paused ? "Couldn't pause alerts" : "Couldn't resume alerts", {
          description: result.error,
        });
        return;
      }

      toast.success(
        paused
          ? `Paused email alerts for ${subscription?.label ?? "subscription"}`
          : `Resumed email alerts for ${subscription?.label ?? "subscription"}`,
      );
      router.refresh();
    });
  }

  return (
    <PageShell className="flex h-full min-h-0 flex-col">
        <section className="relative flex min-h-0 min-w-0 flex-1 bg-card">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <AlertsFilterBar
                searchRef={searchInputRef}
                query={query}
                onQueryChange={setQuery}
                searchFocused={searchFocused}
                onSearchFocusChange={setSearchFocused}
                globalFilters={globalFilterView}
                onGlobalFiltersChange={setGlobalFilterView}
                globalFiltersPending={isGlobalFiltersPending}
                briefingEnabled={briefingEnabled}
                onOpenAddPanel={() => setAddPanelOpen(true)}
              />

              {(actionError || globalFiltersError) && (
                <div className="space-y-2 border-b border-border px-4 py-2">
                  {actionError ? (
                    <InlineError message={actionError} onRetry={() => setActionError(null)} />
                  ) : null}
                  {globalFiltersError ? (
                    <InlineError
                      message={globalFiltersError}
                      onRetry={() => setGlobalFiltersError(null)}
                    />
                  ) : null}
                </div>
              )}

              <div className="flex min-h-0 flex-1 flex-col">
                <AlertsSubscriptionList
                  subscriptions={filteredSubscriptions}
                  activeCount={subscriptions.filter((sub) => !sub.paused).length}
                  pausedCount={subscriptions.filter((sub) => sub.paused).length}
                  globalFilters={activeGlobalFilters}
                  searchQuery={query}
                  pendingPauseId={pendingPauseId}
                  pendingRemoveId={pendingRemoveId}
                  onTogglePaused={toggleSubscriptionPaused}
                  onRemove={requestRemoveSubscription}
                  onSubscriptionUpdated={() => router.refresh()}
                  onAddAlert={() => setAddPanelOpen(true)}
                />
              </div>
            </div>

        </section>

        <AlertsAddSidebarOverlay
          open={addPanelOpen}
          onClose={() => setAddPanelOpen(false)}
          query={addQuery}
          onQueryChange={setAddQuery}
          addableCompanies={addableCompanies}
          bundleSectors={bundleSectors}
          followedSectorSlugs={followedSectorSlugs}
          pendingSectorSlug={pendingSlug}
          pendingCompanyId={pendingCompanyId}
          disabled={isActionPending}
          onAddCompany={addCompany}
          onToggleSector={toggleSector}
        />

      <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove alert?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {removeTarget
                ? `Stop following ${removeTarget.label}. You can add it again from Add alert.`
                : null}
            </p>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(pendingRemoveId)}
              onClick={() => {
                if (!removeTarget) return;
                const target = removeTarget;
                setRemoveTarget(null);
                removeSubscription(target);
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
