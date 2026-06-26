"use client";

import { forwardRef, useRef, useState } from "react";
import {
  Bell,
  Building2,
  CalendarRange,
  ChevronDown,
  Loader2,
  MapPin,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AlertMatchFieldPopover } from "@/components/alerts/alert-match-field-popover";
import { AlertSubscriptionMobileSheet } from "@/components/alerts/alert-subscription-mobile-sheet";
import type { AlertSubscriptionView } from "@/components/alerts/types";
import { CountryFlag } from "@/components/country-flag";
import { MotionStaggerItem, MotionStaggerList } from "@/components/design-system/motion-stagger";
import { EmptyState } from "@/components/design-system/states";
import { SeasonBadge } from "@/components/season-badge";
import { AlertSubscriptionAvatar } from "@/components/alerts/alert-subscription-avatar";
import { Switch } from "@/components/ui/switch";
import {
  alertFiltersToView,
  mergeAlertFilters,
  type AlertFilters,
  type AlertFiltersView,
} from "@/lib/alerts/filters";
import { ALERT_COUNTRY_FILTER_OPTIONS } from "@/lib/alerts/country-options";
import {
  isSubscriptionFieldCustomized,
  type AlertMatchField,
} from "@/lib/alerts/subscription-filters";
import { formatCountryCode } from "@/lib/feed/country-filter";
import { alertTargetTypeLabelClass } from "@/components/alerts/filter-chip-styles";
import { cn } from "@/lib/utils";

const DESKTOP_GRID =
  "grid grid-cols-[minmax(0,0.82fr)_minmax(0,0.88fr)_minmax(0,1.14fr)_minmax(0,0.42fr)_minmax(0,0.48fr)] items-stretch";

const TABLE_TEXT = "text-sm leading-snug";
const ROW_HEIGHT = "min-h-11";

const HEADER_CELL =
  "flex min-h-full items-center border-r border-border/70 px-4 last:border-r-0";
const BODY_CELL =
  "flex min-h-full min-w-0 items-center border-r border-border/50 px-4 last:border-r-0";

type OpenFieldState = { subscriptionId: string; field: AlertMatchField } | null;

function effectiveFiltersView(
  subscription: AlertSubscriptionView,
  globalFilters: AlertFilters,
) {
  const merged = subscription.filterOverride
    ? mergeAlertFilters(globalFilters, subscription.filterOverride)
    : globalFilters;
  return alertFiltersToView(merged);
}

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
  const [openField, setOpenField] = useState<OpenFieldState>(null);
  const [mobileSubscriptionId, setMobileSubscriptionId] = useState<string | null>(null);
  const fieldAnchorRef = useRef<HTMLElement | null>(null);
  const trimmedQuery = searchQuery.trim();

  const openSubscription = openField
    ? subscriptions.find((subscription) => subscription.id === openField.subscriptionId) ?? null
    : null;
  const mobileSubscription = mobileSubscriptionId
    ? subscriptions.find((subscription) => subscription.id === mobileSubscriptionId) ?? null
    : null;

  function closeFieldPopover() {
    fieldAnchorRef.current = null;
    setOpenField(null);
  }

  function openFieldPopover(
    subscriptionId: string,
    field: AlertMatchField,
    anchor: HTMLElement,
  ) {
    fieldAnchorRef.current = anchor;
    setOpenField({ subscriptionId, field });
  }

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-card p-8">
        <EmptyState
          key={trimmedQuery ? "filtered-empty" : "base-empty"}
          title={trimmedQuery ? "No matches" : "No alerts yet"}
          description={
            trimmedQuery
              ? `Nothing matches "${trimmedQuery}". Clear your search or try another term.`
              : "Follow a company or bundle to get an email the moment a matching internship is posted."
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
      <div className="hidden h-full min-h-0 flex-col bg-card md:flex">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section>
            <div
              className={cn(DESKTOP_GRID, ROW_HEIGHT, "border-b border-border bg-muted/25")}
            >
              <HeaderCell label="Following" icon={Building2} />
              <HeaderCell label="Seasons" icon={CalendarRange} />
              <HeaderCell label="Location" icon={MapPin} />
              <HeaderCell label="Type" icon={Tag} />
              <HeaderCell label="Email alerts" icon={Bell} />
            </div>
            <MotionStaggerList as="ul">
              {subscriptions.map((subscription, index) => (
                <SubscriptionRow
                  key={subscription.id}
                  index={index}
                  subscription={subscription}
                  globalFilters={globalFilters}
                  pausePending={pendingPauseId === subscription.id}
                  removePending={pendingRemoveId === subscription.id}
                  openField={openField}
                  onTogglePaused={onTogglePaused}
                  onRemove={onRemove}
                  onOpenField={(field, anchor) =>
                    openFieldPopover(subscription.id, field, anchor)
                  }
                  layout="desktop"
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

      <div className="min-h-0 flex-1 overflow-y-auto bg-card md:hidden">
        <MotionStaggerList as="ul" className="divide-y divide-border">
          {subscriptions.map((subscription, index) => (
            <SubscriptionRow
              key={subscription.id}
              index={index}
              subscription={subscription}
              globalFilters={globalFilters}
              pausePending={pendingPauseId === subscription.id}
              removePending={pendingRemoveId === subscription.id}
              openField={openField}
              onTogglePaused={onTogglePaused}
              onRemove={onRemove}
              onOpenField={(field, anchor) => openFieldPopover(subscription.id, field, anchor)}
              onOpenMobile={() => setMobileSubscriptionId(subscription.id)}
              layout="mobile"
            />
          ))}
        </MotionStaggerList>
      </div>

      {mobileSubscription ? (
        <AlertSubscriptionMobileSheet
          subscription={mobileSubscription}
          globalFilters={globalFilters}
          open
          onClose={() => setMobileSubscriptionId(null)}
          onUpdated={onSubscriptionUpdated}
          onRemove={(subscription) => {
            setMobileSubscriptionId(null);
            onRemove(subscription);
          }}
          removePending={pendingRemoveId === mobileSubscription.id}
        />
      ) : null}

      {openField && openSubscription ? (
        <AlertMatchFieldPopover
          key={`${openField.subscriptionId}:${openField.field}`}
          anchorRef={fieldAnchorRef}
          subscription={openSubscription}
          globalFilters={globalFilters}
          field={openField.field}
          open
          onClose={closeFieldPopover}
          onUpdated={onSubscriptionUpdated}
        />
      ) : null}
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
      <span className={cn("flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground", className)}>
        {Icon ? (
          <Icon size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground/70" aria-hidden />
        ) : null}
        {label}
      </span>
    </div>
  );
}

function SubscriptionRow({
  subscription,
  globalFilters,
  pausePending,
  removePending,
  openField,
  onTogglePaused,
  onRemove,
  onOpenField,
  onOpenMobile,
  layout,
  index,
}: {
  subscription: AlertSubscriptionView;
  globalFilters: AlertFilters;
  pausePending: boolean;
  removePending: boolean;
  openField: OpenFieldState;
  onTogglePaused: (subscriptionId: string, paused: boolean) => void;
  onRemove: (subscription: AlertSubscriptionView) => void;
  onOpenField: (field: AlertMatchField, anchor: HTMLElement) => void;
  onOpenMobile?: () => void;
  layout: "desktop" | "mobile";
  index: number;
}) {
  const rowActionsDisabled = pausePending || removePending;

  const emailAlertsControl = (
    <EmailAlertsToggle
      subscription={subscription}
      disabled={rowActionsDisabled}
      onTogglePaused={onTogglePaused}
      showLabel={layout === "desktop"}
    />
  );

  const seasonsOpen =
    openField?.subscriptionId === subscription.id && openField.field === "seasons";
  const countriesOpen =
    openField?.subscriptionId === subscription.id && openField.field === "countries";

  if (layout === "mobile") {
    return (
      <MotionStaggerItem as="li" index={index}>
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 transition-colors",
            subscription.paused && "opacity-70",
          )}
        >
          <button
            type="button"
            onClick={() => onOpenMobile?.()}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition-colors hover:bg-muted/35 active:bg-muted/45"
          >
            <FollowAvatar subscription={subscription} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{subscription.label}</p>
              <p
                className={cn(
                  "mt-0.5 text-xs font-medium",
                  alertTargetTypeLabelClass(subscription.type),
                )}
              >
                {subscription.type === "company" ? "Company" : "Bundle"}
              </p>
            </div>
          </button>
          {emailAlertsControl}
        </div>
      </MotionStaggerItem>
    );
  }

  return (
    <MotionStaggerItem as="li" index={index}>
    <div
      className={cn(
        DESKTOP_GRID,
        ROW_HEIGHT,
        "group w-full border-b border-border/60 transition-colors hover:bg-muted/35",
        subscription.paused && "opacity-70",
      )}
    >
      <TableCell>
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-4">
            <FollowAvatar subscription={subscription} />
            <span className={cn(TABLE_TEXT, "truncate pl-0.5 font-medium text-foreground")}>
              {subscription.label}
            </span>
          </span>
          <RemoveAlertButton
            subscription={subscription}
            disabled={rowActionsDisabled}
            pending={removePending}
            onRemove={onRemove}
            className={
              removePending
                ? "opacity-100"
                : "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            }
          />
        </span>
      </TableCell>
      <FilterFieldCell
        field="seasons"
        subscription={subscription}
        globalFilters={globalFilters}
        open={seasonsOpen}
        onOpen={(anchor) => onOpenField("seasons", anchor)}
      />
      <FilterFieldCell
        field="countries"
        subscription={subscription}
        globalFilters={globalFilters}
        open={countriesOpen}
        onOpen={(anchor) => onOpenField("countries", anchor)}
      />
      <TableCell>
        <FollowTypeLabel type={subscription.type} />
      </TableCell>
      <TableCell>{emailAlertsControl}</TableCell>
    </div>
    </MotionStaggerItem>
  );
}

function RemoveAlertButton({
  subscription,
  disabled,
  pending,
  onRemove,
  className,
}: {
  subscription: AlertSubscriptionView;
  disabled: boolean;
  pending: boolean;
  onRemove: (subscription: AlertSubscriptionView) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onRemove(subscription);
      }}
      disabled={disabled}
      aria-label={`Remove alert for ${subscription.label}`}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[opacity,background-color,color] duration-150",
        "hover:bg-destructive/10 hover:text-destructive",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {pending ? (
        <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden />
      ) : (
        <Trash2 size={15} strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}

const MATCH_FIELD_LABEL: Record<AlertMatchField, string> = {
  seasons: "Edit seasons",
  countries: "Edit location",
};

const MatchFieldTrigger = forwardRef<
  HTMLButtonElement,
  {
    field: AlertMatchField;
    open: boolean;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    size?: "desktop" | "mobile";
    children: React.ReactNode;
  }
>(function MatchFieldTrigger({ field, open, onClick, size = "desktop", children }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={MATCH_FIELD_LABEL[field]}
      aria-label={MATCH_FIELD_LABEL[field]}
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cn(
        "group flex min-w-0 cursor-pointer items-center gap-1 rounded-md border text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        open
          ? "border-solid border-border bg-muted/40"
          : "border-dashed border-border/55 bg-muted/10 hover:border-border/80 hover:bg-muted/45",
        size === "mobile" ? "w-full px-2 py-1" : "-mx-0.5 w-full px-2 py-1.5",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronDown
        size={14}
        strokeWidth={1.75}
        className={cn(
          "shrink-0 text-muted-foreground/60 transition-transform duration-150",
          "group-hover:text-muted-foreground",
          open && "rotate-180 text-muted-foreground",
        )}
        aria-hidden
      />
    </button>
  );
});

function FilterFieldCell({
  field,
  subscription,
  globalFilters,
  open,
  onOpen,
}: {
  field: AlertMatchField;
  subscription: AlertSubscriptionView;
  globalFilters: AlertFilters;
  open: boolean;
  onOpen: (anchor: HTMLElement) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={cn(BODY_CELL, "relative")}>
      <MatchFieldTrigger
        ref={triggerRef}
        field={field}
        open={open}
        onClick={(event) => {
          event.stopPropagation();
          if (triggerRef.current) {
            onOpen(triggerRef.current);
          }
        }}
      >
        {field === "seasons" ? (
          <SeasonFilterDisplay subscription={subscription} globalFilters={globalFilters} />
        ) : (
          <LocationFilterDisplay subscription={subscription} globalFilters={globalFilters} />
        )}
      </MatchFieldTrigger>
    </div>
  );
}

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(BODY_CELL, className)}>{children}</div>;
}

function EmailAlertsToggle({
  subscription,
  disabled,
  onTogglePaused,
  showLabel = true,
}: {
  subscription: AlertSubscriptionView;
  disabled: boolean;
  onTogglePaused: (subscriptionId: string, paused: boolean) => void;
  showLabel?: boolean;
}) {
  const emailsEnabled = !subscription.paused;

  return (
    <div
      className="flex items-center gap-2"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Switch
        checked={emailsEnabled}
        disabled={disabled}
        onCheckedChange={(enabled) => onTogglePaused(subscription.id, !enabled)}
        aria-label={`Email alerts for ${subscription.label}`}
      />
      {showLabel ? (
        <span
          className={cn(
            "shrink-0 text-xs",
            emailsEnabled ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {emailsEnabled ? "On" : "Paused"}
        </span>
      ) : null}
    </div>
  );
}

function CommaSeparator() {
  return (
    <span className="inline-flex items-center" aria-hidden>
      <span className={cn(TABLE_TEXT, "text-muted-foreground")}>,</span>
      <span className="inline-block w-2" />
    </span>
  );
}

function DefaultLabel() {
  return <span className={cn(TABLE_TEXT, "truncate text-muted-foreground")}>Default</span>;
}

function seasonFiltersView(
  subscription: AlertSubscriptionView,
  globalFilters: AlertFilters,
): AlertFiltersView {
  return isSubscriptionFieldCustomized(subscription.filterOverride, globalFilters, "seasons")
    ? effectiveFiltersView(subscription, globalFilters)
    : alertFiltersToView(globalFilters);
}

function locationFiltersView(
  subscription: AlertSubscriptionView,
  globalFilters: AlertFilters,
): AlertFiltersView {
  return isSubscriptionFieldCustomized(subscription.filterOverride, globalFilters, "countries")
    ? effectiveFiltersView(subscription, globalFilters)
    : alertFiltersToView(globalFilters);
}

function SeasonFilterDisplay({
  subscription,
  globalFilters,
}: {
  subscription: AlertSubscriptionView;
  globalFilters: AlertFilters;
}) {
  if (!isSubscriptionFieldCustomized(subscription.filterOverride, globalFilters, "seasons")) {
    return <DefaultLabel />;
  }

  const filtersView = seasonFiltersView(subscription, globalFilters);

  if (filtersView.seasons.length === 0) {
    return <span className={cn(TABLE_TEXT, "truncate text-muted-foreground")}>All seasons</span>;
  }

  return (
    <span className="inline-flex min-w-0 items-center truncate">
      {filtersView.seasons.map((season, index) => (
        <span key={season} className="inline-flex items-center">
          {index > 0 ? <CommaSeparator /> : null}
          <SeasonBadge season={season} variant="plain" className="shrink-0" />
        </span>
      ))}
    </span>
  );
}

function LocationFilterDisplay({
  subscription,
  globalFilters,
  compact = false,
}: {
  subscription: AlertSubscriptionView;
  globalFilters: AlertFilters;
  compact?: boolean;
}) {
  if (!isSubscriptionFieldCustomized(subscription.filterOverride, globalFilters, "countries")) {
    return <DefaultLabel />;
  }

  const filtersView = locationFiltersView(subscription, globalFilters);

  if (filtersView.countries.length === 0) {
    return <span className={cn(TABLE_TEXT, "truncate text-muted-foreground")}>All locations</span>;
  }

  return (
    <span className="inline-flex min-w-0 items-center truncate">
      {filtersView.countries.map((code, index) => (
        <span key={code} className="inline-flex items-center gap-1">
          {index > 0 ? <CommaSeparator /> : null}
          <CountryFlag code={code} size="sm" />
          {compact ? null : (
            <span className={cn(TABLE_TEXT, "text-muted-foreground")}>
              {ALERT_COUNTRY_FILTER_OPTIONS.find((option) => option.code === code)?.label ??
                formatCountryCode(code)}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function FollowAvatar({ subscription }: { subscription: AlertSubscriptionView }) {
  return <AlertSubscriptionAvatar subscription={subscription} />;
}

function FollowTypeLabel({ type }: { type: "company" | "sector" }) {
  return (
    <span className={cn(TABLE_TEXT, "shrink-0 font-medium", alertTargetTypeLabelClass(type))}>
      {type === "company" ? "Company" : "Bundle"}
    </span>
  );
}
