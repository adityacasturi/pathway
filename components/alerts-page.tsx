"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Loader2, Plus, X } from "lucide-react";
import {
  addCompanyAlert,
  addSectorAlert,
  removeCompanyAlert,
  removeSectorAlert,
  updateAlertsEnabled,
  updateDigestEnabled,
} from "@/lib/actions/alerts";
import { companyMatchesSearch, getDiscoverSearchTerms } from "@/lib/discover/search";
import { AlertsPreviewGate } from "@/components/alerts-preview-gate";
import { CompanyLogo } from "@/components/company-logo";
import { SearchInput } from "@/components/search-input";
import { SectorLogoStack, SECTOR_LOGO_STACK_HEIGHT, type SectorLogoCompany } from "@/components/sector-logo-stack";
import { InlineError } from "@/components/ui/inline-error";
import { PageHeader, PageMain, PageShell } from "@/components/ui/page";
import { Switch } from "@/components/ui/switch";
import { getPageLabel } from "@/lib/config/nav";
import { motionVariants } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

export interface SectorAlertView {
  id: string;
  slug: string;
}

export interface CompanyAlertView {
  id: string;
  companyId: string;
  companySlug: string | null;
  name: string;
  websiteUrl: string | null;
}

export interface AlertCompanyOption {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  industryLabel: string;
}

export interface CuratedSectorView {
  slug: string;
  label: string;
  description: string;
  companies: SectorLogoCompany[];
}

interface Props {
  userEmail: string;
  emailsEnabled: boolean;
  digestEnabled: boolean;
  sectorAlerts: SectorAlertView[];
  companyAlerts: CompanyAlertView[];
  companies: AlertCompanyOption[];
  curatedSectors: CuratedSectorView[];
  /** When true, UI is visible but interactions are blocked by the preview gate. */
  previewMode?: boolean;
}

function activeChipClass(active: boolean) {
  return cn(
    "transition-[border-color,background-color,box-shadow] duration-150",
    active
      ? "border-[color:color-mix(in_oklab,var(--primary)_35%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
      : "border-border bg-card hover:border-[color:var(--rule-strong)] hover:bg-[color-mix(in_oklab,var(--ink)_3%,transparent)]",
  );
}

export function AlertsPage({
  userEmail,
  emailsEnabled: initialEmailsEnabled,
  digestEnabled: initialDigestEnabled,
  sectorAlerts: initialSectorAlerts,
  companyAlerts: initialCompanyAlerts,
  companies,
  curatedSectors,
  previewMode = false,
}: Props) {
  const router = useRouter();
  const [emailsEnabled, setEmailsEnabled] = useState(initialEmailsEnabled);
  const [savedEmailsEnabled, setSavedEmailsEnabled] = useState(initialEmailsEnabled);
  const [digestEnabled, setDigestEnabled] = useState(initialDigestEnabled);
  const [savedDigestEnabled, setSavedDigestEnabled] = useState(initialDigestEnabled);
  const [sectorAlerts, setSectorAlerts] = useState(initialSectorAlerts);
  const [companyAlerts, setCompanyAlerts] = useState(initialCompanyAlerts);
  const [companyQuery, setCompanyQuery] = useState("");
  const deferredCompanyQuery = useDeferredValue(companyQuery);
  const [emailsError, setEmailsError] = useState<string | null>(null);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [pendingCompanyId, setPendingCompanyId] = useState<string | null>(null);
  const [isEmailsPending, startEmailsTransition] = useTransition();
  const [isDigestPending, startDigestTransition] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();

  const alertBySlug = useMemo(
    () => new Map(sectorAlerts.map((alert) => [alert.slug, alert])),
    [sectorAlerts],
  );

  const followedCompanyIds = useMemo(
    () => new Set(companyAlerts.map((alert) => alert.companyId)),
    [companyAlerts],
  );

  const companyResults = useMemo(() => {
    const terms = getDiscoverSearchTerms(deferredCompanyQuery);
    if (terms.length === 0) {
      return [];
    }
    return companies
      .filter((company) => !followedCompanyIds.has(company.id))
      .filter((company) => companyMatchesSearch(company, terms))
      .slice(0, 10);
  }, [companies, deferredCompanyQuery, followedCompanyIds]);

  const alertCount = sectorAlerts.length + companyAlerts.length;

  function onEmailsEnabledChange(next: boolean) {
    setEmailsEnabled(next);
    setEmailsError(null);
    startEmailsTransition(async () => {
      const result = await updateAlertsEnabled(next);
      if (result?.error) {
        setEmailsEnabled(savedEmailsEnabled);
        setEmailsError(result.error);
        return;
      }
      setSavedEmailsEnabled(next);
    });
  }

  function onDigestEnabledChange(next: boolean) {
    setDigestEnabled(next);
    setDigestError(null);
    startDigestTransition(async () => {
      const result = await updateDigestEnabled(next);
      if (result?.error) {
        setDigestEnabled(savedDigestEnabled);
        setDigestError(result.error);
        return;
      }
      setSavedDigestEnabled(next);
    });
  }

  function toggleSector(slug: string) {
    setActionError(null);
    const existing = alertBySlug.get(slug);
    const previous = sectorAlerts;

    if (existing) {
      setSectorAlerts((current) => current.filter((alert) => alert.slug !== slug));
    }

    setPendingSlug(slug);
    startActionTransition(async () => {
      const result = existing
        ? await removeSectorAlert(existing.id)
        : await addSectorAlert(slug);

      setPendingSlug(null);

      if (result?.error) {
        setActionError(result.error);
        setSectorAlerts(previous);
        return;
      }

      router.refresh();
    });
  }

  function addCompany(companyId: string) {
    setActionError(null);
    setPendingCompanyId(companyId);
    startActionTransition(async () => {
      const result = await addCompanyAlert(companyId);
      setPendingCompanyId(null);

      if (result?.error) {
        setActionError(result.error);
        return;
      }

      setCompanyQuery("");
      router.refresh();
    });
  }

  function removeCompany(subscriptionId: string) {
    setActionError(null);
    const previous = companyAlerts;
    setCompanyAlerts((current) => current.filter((alert) => alert.id !== subscriptionId));

    startActionTransition(async () => {
      const result = await removeCompanyAlert(subscriptionId);
      if (result?.error) {
        setActionError(result.error);
        setCompanyAlerts(previous);
        return;
      }
      router.refresh();
    });
  }

  return (
    <PageShell>
      <PageMain>
        <AlertsPreviewGate active={previewMode}>
        <motion.div variants={motionVariants.riseIn} initial={false} animate="visible">
          <PageHeader title={getPageLabel("/alerts")}>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              Email updates sent to{" "}
              <span className="font-medium text-foreground">{userEmail}</span>.
            </p>
          </PageHeader>
        </motion.div>

        <motion.div
          variants={motionVariants.fadeIn}
          initial={false}
          animate="visible"
          className="space-y-10"
        >
          <EmailToggleRow
            title="Daily digest"
            description="Every morning, one email summarizing new roles at companies and sectors you follow."
            checked={digestEnabled}
            disabled={isDigestPending}
            onCheckedChange={onDigestEnabledChange}
            error={digestError}
            onClearError={() => setDigestError(null)}
          />

          <section className="space-y-8">
            <EmailToggleRow
              title="Instant alerts"
              description="Email when a new role is posted at a company or in a sector you follow."
              checked={emailsEnabled}
              disabled={isEmailsPending}
              onCheckedChange={onEmailsEnabledChange}
              error={emailsError}
              onClearError={() => setEmailsError(null)}
            />

            <div>
              <p className="label-meta mb-3">Companies</p>
              <CompanySearchDropdown
                query={companyQuery}
                onQueryChange={setCompanyQuery}
                results={companyResults}
                disabled={isActionPending}
                pendingCompanyId={pendingCompanyId}
                onSelect={addCompany}
              />

              {companyAlerts.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {companyAlerts.map((alert) => (
                    <li key={alert.id}>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border py-1.5 pr-1.5",
                          activeChipClass(true),
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2 pl-4 pr-1">
                          <CompanyLogo
                            company={alert.name}
                            companySlug={alert.companySlug}
                            websiteUrl={alert.websiteUrl}
                            size={24}
                          />
                          <span className="max-w-[12rem] truncate text-[13px] font-medium text-foreground">
                            {alert.name}
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={isActionPending}
                          onClick={() => removeCompany(alert.id)}
                          aria-label={`Remove alert for ${alert.name}`}
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-foreground disabled:opacity-60"
                        >
                          <X size={12} strokeWidth={1.75} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="label-meta mb-1">Curated sectors</p>
              <p className="mb-4 text-[13px] text-muted-foreground">
                Follow a hand-picked group — one alert covers every company in the stack.
              </p>

              <ul className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {curatedSectors.map((sector) => {
                  const active = alertBySlug.has(sector.slug);
                  const pending = pendingSlug === sector.slug && isActionPending;

                  return (
                    <li key={sector.slug} className="h-full">
                      <button
                        type="button"
                        aria-pressed={active}
                        disabled={pending}
                        onClick={() => toggleSector(sector.slug)}
                        className={cn(
                          "group/card flex h-full min-h-[152px] w-full flex-col rounded-2xl border px-4 py-4 text-left",
                          activeChipClass(active),
                          pending && "opacity-70",
                        )}
                      >
                        <div
                          className="mb-3 flex shrink-0 items-center justify-between gap-3"
                          style={{ height: SECTOR_LOGO_STACK_HEIGHT }}
                        >
                          <SectorLogoStack companies={sector.companies} />
                          <span
                            className={cn(
                              "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
                              active
                                ? "text-[color:var(--primary)]"
                                : "text-muted-foreground group-hover/card:text-foreground",
                            )}
                            aria-hidden
                          >
                            {pending ? (
                              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                            ) : active ? (
                              <Check size={14} strokeWidth={2} />
                            ) : (
                              <Plus size={14} strokeWidth={2} />
                            )}
                          </span>
                        </div>
                        <p className="text-[15px] font-medium tracking-tight text-foreground">
                          {sector.label}
                        </p>
                        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-muted-foreground">
                          {sector.description}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {actionError && (
              <InlineError message={actionError} onRetry={() => setActionError(null)} />
            )}

            {!emailsEnabled && alertCount > 0 && (
              <p className="text-[13px] text-muted-foreground">
                Turn on instant alerts to receive email for your {alertCount} follow
                {alertCount === 1 ? "" : "s"}.
              </p>
            )}
          </section>
        </motion.div>
        </AlertsPreviewGate>
      </PageMain>
    </PageShell>
  );
}

function EmailToggleRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
  error,
  onClearError,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (next: boolean) => void;
  error: string | null;
  onClearError: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[16px] font-medium tracking-tight text-foreground">{title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-label={`${checked ? "Disable" : "Enable"} ${title.toLowerCase()}`}
        />
      </div>
      {error && (
        <div className="mt-3">
          <InlineError message={error} onRetry={onClearError} />
        </div>
      )}
    </div>
  );
}

function CompanySearchDropdown({
  query,
  onQueryChange,
  results,
  disabled,
  pendingCompanyId,
  onSelect,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  results: AlertCompanyOption[];
  disabled: boolean;
  pendingCompanyId: string | null;
  onSelect: (companyId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const showMenu = open && query.trim().length > 0;

  return (
    <div ref={rootRef} className="relative max-w-xl">
      <SearchInput
        value={query}
        onChange={(next) => {
          onQueryChange(next);
          setOpen(true);
        }}
        onFocusChange={(focused) => {
          if (focused) {
            setOpen(true);
          }
        }}
        placeholder="Search companies to follow"
      />

      {showMenu && (
        <div
          role="listbox"
          aria-label="Company search results"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[min(16rem,45vh)] overflow-y-auto rounded-xl border border-border bg-popover shadow-[0_24px_48px_-28px_color-mix(in_oklab,var(--ink)_55%,transparent)]"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">No matching companies.</p>
          ) : (
            <ul className="p-1.5">
              {results.map((company) => {
                const pending = pendingCompanyId === company.id;
                return (
                  <li key={company.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      disabled={disabled}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSelect(company.id)}
                      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] disabled:opacity-60"
                    >
                      <CompanyLogo
                        company={company.name}
                        companySlug={company.slug}
                        websiteUrl={company.websiteUrl}
                        size={28}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-foreground">
                          {company.name}
                        </span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {company.industryLabel}
                        </span>
                      </span>
                      {pending ? (
                        <Loader2 size={14} className="animate-spin text-muted-foreground" />
                      ) : (
                        <Plus
                          size={14}
                          strokeWidth={1.75}
                          className="shrink-0 text-muted-foreground group-hover:text-foreground"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
