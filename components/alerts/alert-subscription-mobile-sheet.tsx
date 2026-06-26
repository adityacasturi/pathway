"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { AlertFiltersEditor } from "@/components/alert-filters-editor";
import { AlertSubscriptionAvatar } from "@/components/alerts/alert-subscription-avatar";
import type { AlertSubscriptionView } from "@/components/alerts/types";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";
import { InlineSpinner } from "@/components/ui/loading-indicator";
import { updateSubscriptionAlertFilters } from "@/lib/actions/alerts";
import {
  alertFiltersToView,
  mergeAlertFilters,
  type AlertFilters,
  type AlertFiltersView,
} from "@/lib/alerts/filters";
import {
  clearSubscriptionOverrideField,
  isSubscriptionFieldCustomized,
  resolveSubscriptionFieldOverride,
} from "@/lib/alerts/subscription-filters";
import { alertTargetTypeLabelClass } from "@/components/alerts/filter-chip-styles";
import { useMounted } from "@/lib/ui/use-mounted";
import { cn } from "@/lib/utils";

function fieldView(
  subscription: AlertSubscriptionView,
  globalFilters: AlertFilters,
  field: "seasons" | "countries",
): AlertFiltersView {
  const merged = isSubscriptionFieldCustomized(subscription.filterOverride, globalFilters, field)
    ? alertFiltersToView(mergeAlertFilters(globalFilters, subscription.filterOverride))
    : alertFiltersToView(globalFilters);

  if (field === "seasons") {
    return { seasons: merged.seasons, countries: [], includeRemote: true };
  }
  return { seasons: [], countries: merged.countries, includeRemote: true };
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function SectionHeaderAction({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function AlertSubscriptionFilters({
  subscription,
  globalFilters,
  onUpdated,
  onRemove,
  removePending,
}: {
  subscription: AlertSubscriptionView;
  globalFilters: AlertFilters;
  onUpdated: () => void;
  onRemove: (subscription: AlertSubscriptionView) => void;
  removePending: boolean;
}) {
  const seasonsSaved = useMemo(
    () => fieldView(subscription, globalFilters, "seasons"),
    [subscription, globalFilters],
  );
  const countriesSaved = useMemo(
    () => fieldView(subscription, globalFilters, "countries"),
    [subscription, globalFilters],
  );

  const [draft, setDraft] = useState<AlertFiltersView>(() => ({
    seasons: seasonsSaved.seasons,
    countries: countriesSaved.countries,
    includeRemote: true,
  }));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const seasonsCustom = isSubscriptionFieldCustomized(
    subscription.filterOverride,
    globalFilters,
    "seasons",
  );
  const countriesCustom = isSubscriptionFieldCustomized(
    subscription.filterOverride,
    globalFilters,
    "countries",
  );

  const seasonsDirty = !arraysEqual(draft.seasons, seasonsSaved.seasons);
  const countriesDirty = !arraysEqual(draft.countries, countriesSaved.countries);
  const isDirty = seasonsDirty || countriesDirty;

  function persistOverride(override: Partial<AlertFilters> | null) {
    setError(null);
    startTransition(async () => {
      const result = await updateSubscriptionAlertFilters(subscription.id, override);
      if (result?.error) {
        setError(result.error);
        toast.error("Couldn't save alert filters", { description: result.error });
        return;
      }
      onUpdated();
      toast.success("Alert filters updated");
    });
  }

  function handleSave() {
    let override = subscription.filterOverride;

    if (seasonsDirty) {
      override = resolveSubscriptionFieldOverride(override, globalFilters, {
        field: "seasons",
        values: draft.seasons,
      });
    }
    if (countriesDirty) {
      override = resolveSubscriptionFieldOverride(override, globalFilters, {
        field: "countries",
        values: draft.countries,
      });
    }

    persistOverride(override);
  }

  function resetSeasons() {
    const defaults = alertFiltersToView(globalFilters);
    setDraft((current) => ({ ...current, seasons: defaults.seasons }));
    persistOverride(clearSubscriptionOverrideField(subscription.filterOverride, "seasons"));
  }

  function resetLocation() {
    const defaults = alertFiltersToView(globalFilters);
    setDraft((current) => ({ ...current, countries: defaults.countries }));
    persistOverride(clearSubscriptionOverrideField(subscription.filterOverride, "countries"));
  }

  function clearSeasonsDraft() {
    setDraft((current) => ({ ...current, seasons: [] }));
  }

  function clearLocationDraft() {
    setDraft((current) => ({ ...current, countries: [] }));
  }

  const footerDisabled = isPending || removePending;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-border px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">Seasons</h3>
            <div className="flex items-center gap-3">
              {seasonsCustom ? (
                <SectionHeaderAction
                  label="Use defaults"
                  disabled={footerDisabled}
                  onClick={resetSeasons}
                />
              ) : null}
              {draft.seasons.length > 0 ? (
                <SectionHeaderAction
                  label="Clear"
                  disabled={footerDisabled}
                  onClick={clearSeasonsDraft}
                />
              ) : null}
            </div>
          </div>

          <AlertFiltersEditor
            fields="seasons"
            value={draft}
            onChange={setDraft}
            disabled={footerDisabled}
            hideSectionTitles
            sectionUnstyled
            hideSectionAction
          />
        </section>

        <section className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">Location</h3>
            <div className="flex items-center gap-3">
              {countriesCustom ? (
                <SectionHeaderAction
                  label="Use defaults"
                  disabled={footerDisabled}
                  onClick={resetLocation}
                />
              ) : null}
              {draft.countries.length > 0 ? (
                <SectionHeaderAction
                  label="Clear"
                  disabled={footerDisabled}
                  onClick={clearLocationDraft}
                />
              ) : null}
            </div>
          </div>

          <AlertFiltersEditor
            fields="countries"
            value={draft}
            onChange={setDraft}
            disabled={footerDisabled}
            hideSectionTitles
            sectionUnstyled
            hideSectionAction
          />
        </section>
      </div>

      <div className="shrink-0 border-t border-border px-5 py-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={footerDisabled || !isDirty}
            onClick={handleSave}
          >
            {isPending ? (
              <>
                <InlineSpinner />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={footerDisabled}
            onClick={() => onRemove(subscription)}
          >
            {removePending ? (
              <>
                <InlineSpinner />
                Removing…
              </>
            ) : (
              <>
                <Trash2 size={14} strokeWidth={1.75} className="mr-1.5" aria-hidden />
                Remove
              </>
            )}
          </Button>
        </div>

        {error ? (
          <div className="mt-3">
            <InlineError message={error} onRetry={() => setError(null)} />
          </div>
        ) : null}
      </div>
    </>
  );
}

export function AlertSubscriptionMobileSheet({
  subscription,
  globalFilters,
  open,
  onClose,
  onUpdated,
  onRemove,
  removePending,
}: {
  subscription: AlertSubscriptionView;
  globalFilters: AlertFilters;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onRemove: (subscription: AlertSubscriptionView) => void;
  removePending: boolean;
}) {
  const mounted = useMounted();

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

  if (!open || !mounted) return null;

  const typeLabel = subscription.type === "company" ? "Company" : "Bundle";

  return createPortal(
    <div
      className="ds-overlay-enter fixed inset-0 z-50 flex justify-end bg-[color-mix(in_oklab,var(--ink)_25%,transparent)] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={subscription.label}
    >
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onClose} />
      <aside className="ds-drawer-enter relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-[-16px_0_48px_-20px_color-mix(in_oklab,var(--ink)_22%,transparent)]">
        <header className="relative shrink-0 border-b border-border px-5 py-4 pr-12">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
          <div className="flex items-start gap-3">
            <AlertSubscriptionAvatar subscription={subscription} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold leading-tight text-foreground">
                {subscription.label}
              </h2>
              <p
                className={cn(
                  "mt-1 text-xs font-medium",
                  alertTargetTypeLabelClass(subscription.type),
                )}
              >
                {typeLabel}
              </p>
            </div>
          </div>
        </header>

        <AlertSubscriptionFilters
          key={`${subscription.id}:${JSON.stringify(subscription.filterOverride ?? null)}`}
          subscription={subscription}
          globalFilters={globalFilters}
          onUpdated={onUpdated}
          onRemove={onRemove}
          removePending={removePending}
        />
      </aside>
    </div>,
    document.body,
  );
}
