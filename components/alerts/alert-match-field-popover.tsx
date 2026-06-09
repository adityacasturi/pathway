"use client";

import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import {
  AlertDefaultsActiveRail,
  AlertFiltersEditor,
} from "@/components/alert-filters-editor";
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
  type AlertMatchField,
} from "@/lib/alerts/subscription-filters";
import { useMounted } from "@/lib/ui/use-mounted";

const FIELD_LABEL: Record<AlertMatchField, string> = {
  seasons: "Seasons",
  countries: "Location",
};

const PANEL_WIDTH = 384;
const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 20;

function fieldView(
  subscription: AlertSubscriptionView,
  globalFilters: AlertFilters,
  field: AlertMatchField,
): AlertFiltersView {
  const merged = isSubscriptionFieldCustomized(subscription.filterOverride, globalFilters, field)
    ? alertFiltersToView(mergeAlertFilters(globalFilters, subscription.filterOverride))
    : alertFiltersToView(globalFilters);

  if (field === "seasons") {
    return { seasons: merged.seasons, countries: [], includeRemote: true };
  }
  return { seasons: [], countries: merged.countries, includeRemote: true };
}

function eventInside(
  event: Event,
  ...refs: Array<RefObject<HTMLElement | null>>
): boolean {
  const path = event.composedPath();
  for (const node of path) {
    if (!(node instanceof Node)) continue;
    for (const ref of refs) {
      if (ref.current?.contains(node)) {
        return true;
      }
    }
  }
  return false;
}

function panelPosition(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const anchorCenter = rect.left + rect.width / 2;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(anchorCenter - width / 2, window.innerWidth - width - VIEWPORT_MARGIN),
  );

  return {
    top: rect.bottom + PANEL_GAP,
    left,
    width,
  };
}

export function AlertMatchFieldPopover({
  subscription,
  globalFilters,
  field,
  open,
  anchorRef,
  onClose,
  onUpdated,
}: {
  subscription: AlertSubscriptionView;
  globalFilters: AlertFilters;
  field: AlertMatchField;
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const popoverSessionRef = useRef({ open: false, key: "" });
  const isCustom = isSubscriptionFieldCustomized(subscription.filterOverride, globalFilters, field);
  const savedView = fieldView(subscription, globalFilters, field);
  const summaryView = isCustom
    ? fieldView(subscription, globalFilters, field)
    : alertFiltersToView(globalFilters);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AlertFiltersView>(() => fieldView(subscription, globalFilters, field));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    const key = open ? `${subscription.id}:${field}` : "";
    const prev = popoverSessionRef.current;
    const sessionChanged = open !== prev.open || key !== prev.key;
    popoverSessionRef.current = { open, key };

    if (!open || !sessionChanged) return;

    setEditing(false);
    setDraft(fieldView(subscription, globalFilters, field));
    setError(null);
  }, [open, subscription.id, field, globalFilters, subscription]);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      setPanelStyle(panelPosition(anchor));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (eventInside(event, anchorRef, panelRef)) {
        return;
      }
      onClose();
    }

    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  const isDirty =
    field === "seasons"
      ? JSON.stringify(draft.seasons) !== JSON.stringify(savedView.seasons)
      : JSON.stringify(draft.countries) !== JSON.stringify(savedView.countries);

  function persistOverride(
    override: Partial<AlertFilters> | null,
    options?: { exitEditing?: boolean },
  ) {
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
      if (options?.exitEditing) {
        setEditing(false);
      }
    });
  }

  function updateDraft(next: AlertFiltersView) {
    setDraft(next);
  }

  function handleSave() {
    const values = field === "seasons" ? draft.seasons : draft.countries;
    persistOverride(
      resolveSubscriptionFieldOverride(subscription.filterOverride, globalFilters, {
        field,
        values,
      }),
      { exitEditing: true },
    );
  }

  function resetToDefault() {
    setEditing(false);
    setDraft(savedView);
    persistOverride(clearSubscriptionOverrideField(subscription.filterOverride, field));
  }

  function startCustomizing(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setEditing(true);
    setDraft(fieldView(subscription, globalFilters, field));
  }

  function goBack() {
    setEditing(false);
    setDraft(savedView);
    setError(null);
  }

  if (!open || !mounted || !panelStyle) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: panelStyle.top,
        left: panelStyle.left,
        width: panelStyle.width,
        zIndex: 60,
      }}
      className="max-h-[min(36rem,calc(100vh-5rem))] overflow-hidden rounded-lg border border-border bg-card shadow-md"
      role="dialog"
      aria-label={`${subscription.label} ${FIELD_LABEL[field]}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex max-h-[min(36rem,calc(100vh-5rem))] flex-col">
        <div className="shrink-0 border-b border-border px-4 py-3">
          {editing ? (
            <button
              type="button"
              onClick={goBack}
              className="mb-2 inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ChevronLeft size={14} strokeWidth={1.75} aria-hidden />
              Back
            </button>
          ) : null}
          <div className="flex items-center gap-3">
            <AlertSubscriptionAvatar subscription={subscription} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{subscription.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{FIELD_LABEL[field]}</p>
            </div>
          </div>
        </div>

        {editing ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
              <AlertFiltersEditor
                fields={field === "seasons" ? "seasons" : "countries"}
                value={draft}
                onChange={updateDraft}
                disabled={isPending}
                clearLabel="Reset to default"
                alwaysShowClear
                onClearAction={resetToDefault}
              />
            </div>
            <div className="shrink-0 border-t border-border px-4 py-3">
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={isPending || !isDirty}
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
            </div>
          </>
        ) : (
          <div className="space-y-4 px-4 py-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {isCustom ? "Custom for this alert" : "Using your defaults"}
              </p>
              <AlertDefaultsActiveRail readOnly field={field} value={summaryView} />
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={startCustomizing}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {isCustom ? "Edit" : "Customize"}
            </Button>
          </div>
        )}

        {error ? (
          <div className="border-t border-border px-4 py-2">
            <InlineError message={error} onRetry={() => setError(null)} />
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
