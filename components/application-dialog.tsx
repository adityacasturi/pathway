"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createApplication } from "@/lib/actions/applications";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Chip } from "@/components/ui/chip";
import { SeasonDot } from "@/components/season-filter-section";
import { APPLICATION_SEASONS, ApplicationEvent, ApplicationSeason } from "@/types/application";
import { validateExternalHttpUrl } from "@/lib/url";
import { cn } from "@/lib/utils";

function Field({
  id,
  label,
  optional,
  children,
  className,
}: {
  id?: string;
  label: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={id} className={cn("block space-y-2", className)}>
      <span className="text-sm font-medium text-foreground/80">
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground/70"> · optional</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

const SEASON_COLOR_VAR: Record<ApplicationSeason, string> = {
  Summer: "--season-summer-fg",
  Fall: "--season-fall-fg",
  Spring: "--season-spring-fg",
  Winter: "--season-winter-fg",
};

function seasonChipStyle(season: ApplicationSeason, active: boolean): CSSProperties | undefined {
  if (!active) {
    return undefined;
  }

  const color = `var(${SEASON_COLOR_VAR[season]})`;
  return {
    borderColor: `color-mix(in oklab, ${color} 38%, var(--border))`,
    backgroundColor: `color-mix(in oklab, ${color} 14%, var(--tint-base))`,
    color,
  };
}

function ApplicationSeasonPicker({
  value,
  onChange,
}: {
  value: "" | ApplicationSeason;
  onChange: (next: "" | ApplicationSeason) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Season">
      <Chip
        label="None"
        active={value === ""}
        onClick={() => onChange("")}
      />
      {APPLICATION_SEASONS.map((season) => (
        <Chip
          key={season}
          label={season}
          prefix={<SeasonDot season={season} />}
          active={value === season}
          onClick={() => onChange(season)}
          style={seasonChipStyle(season, value === season)}
        />
      ))}
    </div>
  );
}

interface InitialValues {
  company?: string;
  role?: string;
  posting_url?: string;
  location?: string;
  season?: ApplicationSeason | null;
}

export interface CreatedApplicationSummary {
  id: string;
  company: string;
  role: string;
  postingUrl: string | null;
  location: string | null;
  season: ApplicationSeason | null;
  dateApplied: string;
  appliedEvent: ApplicationEvent;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialValues?: InitialValues;
  onCreated?: (application: CreatedApplicationSummary) => void;
}

export function ApplicationDialog({ open, onClose, initialValues, onCreated }: Props) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(42rem,88dvh)] sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
          <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
            Add application
          </DialogTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Track a role you applied to or plan to apply to.
          </p>
        </DialogHeader>

        {open ? (
          <ApplicationDialogForm
            initialValues={initialValues}
            onClose={onClose}
            onCreated={onCreated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ApplicationDialogForm({
  onClose,
  initialValues,
  onCreated,
}: {
  onClose: () => void;
  initialValues?: InitialValues;
  onCreated?: (application: CreatedApplicationSummary) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(initialValues?.company ?? "");
  const [role, setRole] = useState(initialValues?.role ?? "");
  const [postingUrl, setPostingUrl] = useState(initialValues?.posting_url ?? "");
  const [location, setLocation] = useState(initialValues?.location ?? "");
  const [dateApplied, setDateApplied] = useState(format(new Date(), "yyyy-MM-dd"));
  const [season, setSeason] = useState<"" | ApplicationSeason>(initialValues?.season ?? "");

  const canSubmit =
    state !== "pending" &&
    company.trim().length > 0 &&
    role.trim().length > 0 &&
    dateApplied.length > 0;

  function clearErrorOnEdit() {
    if (state === "error") setState("idle");
    if (error) setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedCompany = company.trim();
    const trimmedRole = role.trim();
    if (!trimmedCompany) {
      setError("Company name is required.");
      setState("error");
      return;
    }
    if (!trimmedRole) {
      setError("Role is required.");
      setState("error");
      return;
    }
    const validatedPostingUrl = validateExternalHttpUrl(postingUrl);
    if (validatedPostingUrl.error) {
      setError(validatedPostingUrl.error);
      setState("error");
      return;
    }

    const formData = new FormData();
    formData.set("company", company);
    formData.set("role", role);
    formData.set("posting_url", validatedPostingUrl.url ?? "");
    formData.set("location", location);
    formData.set("season", season);
    formData.set("date_applied", dateApplied);

    setState("pending");
    const result = await createApplication(formData, { revalidate: !onCreated });

    if ("error" in result) {
      setError(result.error ?? "Unable to add application.");
      setState("error");
      return;
    }

    setState("success");
    if (onCreated) {
      onCreated({
        id: result.id,
        company: trimmedCompany,
        role: trimmedRole,
        postingUrl: validatedPostingUrl.url,
        location: location.trim() || null,
        season: season || null,
        dateApplied,
        appliedEvent: result.appliedEvent,
      });
    } else {
      router.refresh();
    }
    onClose();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:block sm:flex-none sm:space-y-5 sm:overflow-y-auto sm:overscroll-contain sm:px-6 sm:py-5"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5 [scrollbar-width:thin] sm:flex-none sm:overflow-visible sm:p-0">
      <Field id="application-company" label="Company">
        <Input
          id="application-company"
          name="company"
          required
          placeholder="Acme Corp"
          value={company}
          onChange={(event) => {
            clearErrorOnEdit();
            setCompany(event.target.value);
          }}
        />
      </Field>

      <Field id="application-role" label="Role">
        <Input
          id="application-role"
          name="role"
          required
          placeholder="Software Engineer Intern"
          value={role}
          onChange={(event) => {
            clearErrorOnEdit();
            setRole(event.target.value);
          }}
        />
      </Field>

      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <Field id="application-date-applied" label="Applied date" className="min-w-0">
          <div className="min-w-0 overflow-hidden">
            <Input
              id="application-date-applied"
              name="date_applied"
              type="date"
              required
              value={dateApplied}
              className="min-w-0 max-w-full text-sm"
              onChange={(event) => {
                clearErrorOnEdit();
                setDateApplied(event.target.value);
              }}
            />
          </div>
        </Field>

        <Field id="application-location" label="Location" optional className="min-w-0">
          <Input
            id="application-location"
            name="location"
            placeholder="New York, NY"
            value={location}
            onChange={(event) => {
              clearErrorOnEdit();
              setLocation(event.target.value);
            }}
          />
        </Field>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground/80">
          Season <span className="font-normal text-muted-foreground/70">· optional</span>
        </span>
        <input type="hidden" name="season" value={season} />
        <ApplicationSeasonPicker
          value={season}
          onChange={(value) => {
            clearErrorOnEdit();
            setSeason(value);
          }}
        />
      </div>

      <Field id="application-posting-url" label="Posting URL" optional>
        <Input
          id="application-posting-url"
          name="posting_url"
          type="url"
          placeholder="https://…"
          value={postingUrl}
          onChange={(event) => {
            clearErrorOnEdit();
            setPostingUrl(event.target.value);
          }}
        />
      </Field>

      {error ? <InlineError message={error} /> : null}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-border bg-card px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 sm:pt-5">
        <Button type="button" variant="ghost" onClick={onClose} disabled={state === "pending"}>
          Cancel
        </Button>
        <AsyncButton
          type="submit"
          state={state}
          idleLabel="Add application"
          pendingLabel="Saving…"
          successLabel="Saved"
          errorLabel="Try again"
          disabled={!canSubmit}
        />
      </div>
    </form>
  );
}
