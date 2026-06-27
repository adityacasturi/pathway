"use client";

import { useState } from "react";
import { Bell, Building2, Pencil, Plus, SlidersHorizontal, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AlertSubscriptionDetailDialog } from "@/components/alerts/alert-subscription-detail-dialog";
import type { AlertSubscriptionView } from "@/components/alerts/types";
import { MotionStaggerItem, MotionStaggerList } from "@/components/design-system/motion-stagger";
import { EmptyState } from "@/components/design-system/states";
import { AlertSubscriptionAvatar } from "@/components/alerts/alert-subscription-avatar";
import { Switch } from "@/components/ui/switch";
import type { AlertFilters } from "@/lib/alerts/filters";
import { isSubscriptionFiltersCustomized } from "@/lib/alerts/subscription-filters";
import { alertSubscriptionTypeLabel } from "@/lib/alerts/subscription-type-label";
import { alertTargetTypeLabelClass } from "@/components/alerts/filter-chip-styles";
import { cn } from "@/lib/utils";

const DESKTOP_GRID =
  "grid grid-cols-[minmax(0,1.65fr)_minmax(5rem,0.85fr)_minmax(5rem,0.85fr)_minmax(5.75rem,1fr)] items-stretch";

const TABLE_TEXT = "text-sm leading-snug";
const ROW_HEIGHT = "min-h-11";

const HEADER_CELL =
  "flex min-h-full items-center border-r border-border/70 px-4 last:border-r-0";
const BODY_CELL =
  "flex min-h-full min-w-0 items-center border-r border-border/50 px-4 last:border-r-0";

export function AlertsSubscriptionList({
  subscriptions,
  activeCount,
  pausedCount,
  globalFilters,
  searchQuery,
  pendingPauseId,
  pendingRemoveId,
  onTogglePaused,
  onRemove,
  onSubscriptionUpdated,
  onAddAlert,
}: {
  subscriptions: AlertSubscriptionView[];
  activeCount: number;
  pausedCount: number;
  globalFilters: AlertFilters;
  searchQuery: string;
  pendingPauseId: string | null;
  pendingRemoveId: string | null;
  onTogglePaused: (subscriptionId: string, paused: boolean) => void;
  onRemove: (subscription: AlertSubscriptionView) => void;
  onSubscriptionUpdated: () => void;
  onAddAlert?: () => void;
}) {
  const [detailSubscriptionId, setDetailSubscriptionId] = useState<string | null>(null);
  const trimmedQuery = searchQuery.trim();

  const detailSubscription = detailSubscriptionId
    ? subscriptions.find((subscription) => subscription.id === detailSubscriptionId) ?? null
    : null;

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-card p-8">
        <EmptyState
          key={trimmedQuery ? "filtered-empty" : "base-empty"}
          title={trimmedQuery ? "No matches" : "No alerts yet"}
          description={
            trimmedQuery
              ? `Nothing matches "${trimmedQuery}". Clear your search or try another term.`
              : "Follow a company or industry to get email when matching internships are posted."
          }
          primaryAction={
            !trimmedQuery && onAddAlert
              ? { label: "Add alert", onClick: onAddAlert, icon: <Plus size={14} /> }
              : undefined
          }
          secondaryAction={
            !trimmedQuery ? { label: "Browse companies", href: "/companies" } : undefined
          }
          className="max-w-md border-none bg-transparent py-8"
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col bg-card">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section>
            <div
              className={cn(DESKTOP_GRID, ROW_HEIGHT, COMPACT_COL_GRID, "border-b border-border bg-muted/25")}
            >
              <HeaderCell label="Following" icon={Building2} />
              <HeaderCell label="Filters" icon={SlidersHorizontal} />
              <HeaderCell label="Type" icon={Tag} />
              <HeaderCell label="Email" icon={Bell} />
            </div>
            <MotionStaggerList as="ul">
              {subscriptions.map((subscription, index) => (
                <SubscriptionRow
                  key={subscription.id}
                  index={index}
                  subscription={subscription}
                  globalFilters={globalFilters}
                  pausePending={pendingPauseId === subscription.id}
                  rowDisabled={pendingPauseId === subscription.id || pendingRemoveId === subscription.id}
                  onTogglePaused={onTogglePaused}
                  onOpenDetail={() => setDetailSubscriptionId(subscription.id)}
                />
              ))}
            </MotionStaggerList>
          </section>
        </div>

        <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-2">
          <p className="text-xs text-foreground/75">
            <span className="font-medium tabular-nums text-foreground">{activeCount}</span> sending
            email{activeCount === 1 ? "" : "s"}
            {pausedCount > 0 ? (
              <>
                {" "}
                ·{" "}
                <span className="font-medium tabular-nums text-foreground">{pausedCount}</span> paused
              </>
            ) : null}
          </p>
        </div>
      </div>

      <AlertSubscriptionDetailDialog
        subscription={detailSubscription}
        globalFilters={globalFilters}
        open={Boolean(detailSubscription)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSubscriptionId(null);
          }
        }}
        onUpdated={onSubscriptionUpdated}
        onRemove={onRemove}
        removePending={Boolean(detailSubscription && pendingRemoveId === detailSubscription.id)}
      />
    </>
  );
}

function HeaderCell({
  label,
  icon: Icon,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={HEADER_CELL}>
      <span
        className={cn(
          "flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground",
          className,
        )}
      >
        {Icon ? (
          <Icon size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground/70" aria-hidden />
        ) : null}
        {label}
      </span>
    </div>
  );
}

const COMPACT_COL_GRID = "[&>*:nth-child(2)]:px-3 [&>*:nth-child(3)]:px-3";

function SubscriptionRow({
  subscription,
  globalFilters,
  pausePending,
  rowDisabled,
  onTogglePaused,
  onOpenDetail,
  index,
}: {
  subscription: AlertSubscriptionView;
  globalFilters: AlertFilters;
  pausePending: boolean;
  rowDisabled: boolean;
  onTogglePaused: (subscriptionId: string, paused: boolean) => void;
  onOpenDetail: () => void;
  index: number;
}) {
  const emailsEnabled = !subscription.paused;
  const filtersCustomized = isSubscriptionFiltersCustomized(
    subscription.filterOverride,
    globalFilters,
  );

  return (
    <MotionStaggerItem as="li" index={index}>
      <div
        className={cn(
          DESKTOP_GRID,
          ROW_HEIGHT,
          COMPACT_COL_GRID,
          "w-full border-b border-border/60 transition-colors hover:bg-muted/35",
          subscription.paused && "opacity-70",
        )}
      >
        <div className={BODY_CELL}>
          <button
            type="button"
            onClick={onOpenDetail}
            disabled={rowDisabled}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AlertSubscriptionAvatar subscription={subscription} />
            <span className={cn(TABLE_TEXT, "truncate font-medium text-foreground")}>
              {subscription.label}
            </span>
          </button>
        </div>
        <div className={cn(BODY_CELL, "group/filters")}>
          <button
            type="button"
            onClick={onOpenDetail}
            disabled={rowDisabled}
            aria-label={`Edit filters for ${subscription.label}`}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiltersLabel customized={filtersCustomized} />
            <Pencil
              size={13}
              strokeWidth={1.75}
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/filters:opacity-100 group-focus-within/filters:opacity-100"
              aria-hidden
            />
          </button>
        </div>
        <div className={BODY_CELL}>
          <span
            className={cn(
              TABLE_TEXT,
              "shrink-0 font-medium",
              alertTargetTypeLabelClass(subscription.type),
            )}
          >
            {alertSubscriptionTypeLabel(subscription.type)}
          </span>
        </div>
        <div className={BODY_CELL}>
          <div
            className="flex items-center gap-2"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Switch
              checked={emailsEnabled}
              disabled={rowDisabled || pausePending}
              onCheckedChange={(enabled) => onTogglePaused(subscription.id, !enabled)}
              aria-label={`Email alerts for ${subscription.label}`}
            />
            <span
              className={cn(
                "shrink-0 text-xs",
                emailsEnabled ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {emailsEnabled ? "On" : "Off"}
            </span>
          </div>
        </div>
      </div>
    </MotionStaggerItem>
  );
}

function FiltersLabel({ customized }: { customized: boolean }) {
  return (
    <span
      className={cn(
        TABLE_TEXT,
        customized ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {customized ? "Custom" : "Default"}
    </span>
  );
}
