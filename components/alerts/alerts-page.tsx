"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertsAddDialog } from "@/components/alerts/alerts-add-dialog";
import { AlertsFilterBar } from "@/components/alerts/alerts-filter-bar";
import { AlertsSubscriptionList } from "@/components/alerts/alerts-subscription-list";
import type {
  AlertCompanyOption,
  AlertSubscriptionView,
  CuratedSectorView,
} from "@/components/alerts/types";
import { PageShell } from "@/components/design-system/page";
import { InlineError } from "@/components/ui/inline-error";
import {
  addCompanyAlert,
  addSectorAlert,
  removeCompanyAlert,
  removeSectorAlert,
  setAlertSubscriptionPaused,
  updateAlertGlobalFilters,
} from "@/lib/actions/alerts";
import {
  filterAddableCompanies,
  filterSectorsByQuery,
  getPopularAddableCompanies,
} from "@/lib/alerts/addable-targets";
import {
  alertFiltersToView,
  viewToAlertFilters,
  type AlertFilters,
  type AlertFiltersView,
} from "@/lib/alerts/filters";
import { sortAlertSubscriptions } from "@/lib/alerts/subscription-sort";
import { ALERT_DEFAULTS_SAVE_DEBOUNCE_MS, ALERT_POPULAR_COMPANY_SLUGS } from "@/lib/config/alerts";

const ADD_ALERT_ACTION_DEBOUNCE_MS = 400;
import { useFocusSearchShortcut } from "@/lib/ui/focus-search-shortcut";
import { getSearchTerms } from "@/lib/search-terms";

interface Props {
  globalFilters: AlertFilters;
  subscriptions: AlertSubscriptionView[];
  companies: AlertCompanyOption[];
  curatedSectors: CuratedSectorView[];
}

export function AlertsPage({
  globalFilters: initialGlobalFilters,
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
  const [, startActionTransition] = useTransition();
  const lastAddActionAtRef = useRef(0);
  const [globalFilterView, setGlobalFilterView] = useState<AlertFiltersView>(() =>
    alertFiltersToView(initialGlobalFilters),
  );
  const [savedGlobalFilterView, setSavedGlobalFilterView] = useState(globalFilterView);
  const [globalFiltersError, setGlobalFiltersError] = useState<string | null>(null);
  const globalFilterViewRef = useRef(globalFilterView);

  useEffect(() => {
    globalFilterViewRef.current = globalFilterView;
  }, [globalFilterView]);

  const searchInputRef = useRef<HTMLDivElement | null>(null);
  useFocusSearchShortcut(searchInputRef);

  useEffect(() => {
    if (JSON.stringify(globalFilterView) === JSON.stringify(savedGlobalFilterView)) {
      return;
    }

    const timer = window.setTimeout(() => {
      const viewToSave = globalFilterViewRef.current;
      setGlobalFiltersError(null);
      void updateAlertGlobalFilters(viewToSave).then((result) => {
        if (result?.error) {
          setGlobalFiltersError(result.error);
          setGlobalFilterView(savedGlobalFilterView);
          toast.error("Couldn't save alert defaults", { description: result.error });
          return;
        }
        setSavedGlobalFilterView(viewToSave);
      });
    }, ALERT_DEFAULTS_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [globalFilterView, savedGlobalFilterView]);

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

  const popularCompanies = useMemo(
    () => getPopularAddableCompanies(companies, followedCompanyIds, ALERT_POPULAR_COMPANY_SLUGS),
    [companies, followedCompanyIds],
  );

  const activeGlobalFilters = useMemo(
    () => viewToAlertFilters(savedGlobalFilterView),
    [savedGlobalFilterView],
  );

  const addDialogBusy = Boolean(pendingCompanyId || pendingSlug);

  function guardAddDialogAction() {
    if (addDialogBusy) {
      return true;
    }
    const now = Date.now();
    if (now - lastAddActionAtRef.current < ADD_ALERT_ACTION_DEBOUNCE_MS) {
      return true;
    }
    lastAddActionAtRef.current = now;
    return false;
  }

  function toggleSector(slug: string) {
    if (guardAddDialogAction()) return;
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
          feedSlug: null,
          websiteUrl: null,
          sectorCompanies: sector.companies,
          filterOverride: null,
          paused: false,
          cadence: "instant",
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
        toast.error(existing ? "Couldn't remove industry" : "Couldn't follow industry", {
          description: result.error,
        });
        return;
      }

      toast.success(
        existing
          ? `Unfollowed ${sector?.label ?? "industry"}`
          : `Now following ${sector?.label ?? "industry"}`,
      );
      router.refresh();
    });
  }

  function addCompany(companyId: string) {
    if (guardAddDialogAction()) return;
    setActionError(null);
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;

    setPendingCompanyId(companyId);
    startActionTransition(async () => {
      const result = await addCompanyAlert(companyId);
      setPendingCompanyId(null);

      if (result?.error) {
        setActionError(result.error);
        toast.error("Couldn't follow company", { description: result.error });
        return;
      }

      toast.success(`Now following ${company.name}`);
      router.refresh();
    });
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
                  onRemove={removeSubscription}
                  onSubscriptionUpdated={() => router.refresh()}
                  onAddAlert={() => setAddPanelOpen(true)}
                />
              </div>
            </div>

        </section>

        <AlertsAddDialog
          open={addPanelOpen}
          onOpenChange={(open) => {
            setAddPanelOpen(open);
            if (!open) {
              setAddQuery("");
            }
          }}
          query={addQuery}
          onQueryChange={setAddQuery}
          addableCompanies={addableCompanies}
          popularCompanies={popularCompanies}
          bundleSectors={bundleSectors}
          followedSectorSlugs={followedSectorSlugs}
          pendingSectorSlug={pendingSlug}
          pendingCompanyId={pendingCompanyId}
          disabled={addDialogBusy}
          onAddCompany={addCompany}
          onToggleSector={toggleSector}
        />

    </PageShell>
  );
}
