"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createApplication } from "@/lib/actions/applications";
import { AnimatePresence, motion } from "framer-motion";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import { motionVariants, transitions } from "@/lib/ui/motion";
import { APPLICATION_SEASONS, ApplicationEvent, ApplicationSeason } from "@/types/application";
import { validateExternalHttpUrl } from "@/lib/url";
import { cn } from "@/lib/utils";

const DIALOG_LABEL_CLASS = "text-[11px] uppercase tracking-widest text-muted-foreground font-medium";
const DIALOG_INPUT_CLASS = "h-11 rounded-lg text-sm bg-background/80 border-border/70";
const DIALOG_TEXT_INPUT_CLASS = `${DIALOG_INPUT_CLASS} placeholder:text-muted-foreground/40`;
const DIALOG_ACTION_CLASS = "h-9 px-4 text-xs uppercase tracking-wider transition-colors duration-200";

function ApplicationField({
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
    <motion.div layout className={cn("space-y-2", className)} transition={transitions.layout}>
      <Label htmlFor={id} className={DIALOG_LABEL_CLASS}>
        {label}{" "}
        {optional ? (
          <span className="normal-case tracking-normal text-muted-foreground/40">(optional)</span>
        ) : null}
      </Label>
      {children}
    </motion.div>
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
  /** Pre-populates the form. Handy when opening from the discover feed. */
  initialValues?: InitialValues;
  onCreated?: (application: CreatedApplicationSummary) => void;
}

export function ApplicationDialog({ open, onClose, initialValues, onCreated }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden rounded-lg border bg-popover p-8"
        style={{ borderColor: "var(--rule-strong)" }}
      >
        <DialogHeader className="mb-7">
          <DialogTitle className="display-serif text-[30px] text-foreground">
            Add application
          </DialogTitle>
        </DialogHeader>

        {open && (
          <ApplicationDialogForm
            initialValues={initialValues}
            onClose={onClose}
            onCreated={onCreated}
          />
        )}
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
  // Season has no native input primitive that fits the design, so it rides
  // alongside the rest of the form as component state and is submitted via a
  // hidden input. Empty string = no season set.
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    } else {
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
  }

  return (
    <motion.form
      layout
      onSubmit={handleSubmit}
      className="space-y-5"
      transition={transitions.layout}
    >
          <ApplicationField id="application-company" label="Company">
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
              className={DIALOG_TEXT_INPUT_CLASS}
            />
          </ApplicationField>

          <ApplicationField id="application-role" label="Role">
            <Input
              id="application-role"
              name="role"
              required
              placeholder="Rocket Skate Engineer Intern"
              value={role}
              onChange={(event) => {
                clearErrorOnEdit();
                setRole(event.target.value);
              }}
              className={DIALOG_TEXT_INPUT_CLASS}
            />
          </ApplicationField>

          <ApplicationField id="application-date-applied" label="Applied date">
            <Input
              id="application-date-applied"
              name="date_applied"
              type="date"
              required
              value={dateApplied}
              onChange={(event) => {
                clearErrorOnEdit();
                setDateApplied(event.target.value);
              }}
              className={DIALOG_INPUT_CLASS}
            />
          </ApplicationField>

          <ApplicationField id="application-posting-url" label="Posting URL" optional>
            <Input
              id="application-posting-url"
              name="posting_url"
              type="url"
              placeholder="https://acme.com/careers/rocket-skate-intern"
              value={postingUrl}
              onChange={(event) => {
                clearErrorOnEdit();
                setPostingUrl(event.target.value);
              }}
              className={DIALOG_TEXT_INPUT_CLASS}
            />
          </ApplicationField>

          <motion.div layout className="grid grid-cols-[1fr_auto] gap-4" transition={transitions.layout}>
            <ApplicationField id="application-location" label="Location" optional className="min-w-0">
              <Input
                id="application-location"
                name="location"
                placeholder="New York · Seattle"
                value={location}
                onChange={(event) => {
                  clearErrorOnEdit();
                  setLocation(event.target.value);
                }}
                className={DIALOG_TEXT_INPUT_CLASS}
              />
            </ApplicationField>
            <div className="space-y-2">
              <Label className={DIALOG_LABEL_CLASS}>
                Season
              </Label>
              {/* Tri-state segmented control: none / summer / fall. Clicking
                  the active choice clears it so there's no "reset" button. */}
              <input type="hidden" name="season" value={season} />
              <div
                className="inline-flex h-11 rounded-md border bg-background p-1"
                style={{ borderColor: "var(--rule)" }}
              >
                {(["", ...APPLICATION_SEASONS] as const).map((option) => {
                  const active = season === option;
                  const label = option === "" ? "—" : option;
                  return (
                    <button
                      key={option || "none"}
                      type="button"
                      onClick={() => {
                        clearErrorOnEdit();
                        setSeason(option);
                      }}
                      aria-pressed={active}
                      className={`relative rounded-sm px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-200 ${
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="application-season-active"
                          className="absolute inset-0 rounded-sm bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]"
                          transition={transitions.layout}
                        />
                      )}
                      <span className="relative">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                layout
                variants={motionVariants.gentleScale}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={transitions.layout}
              >
                <InlineError message={error} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={state === "pending"}
              className={`${DIALOG_ACTION_CLASS} text-muted-foreground hover:text-foreground`}
            >
              Cancel
            </Button>
            <AsyncButton
              type="submit"
              state={state}
              idleLabel="Add"
              pendingLabel="Saving"
              successLabel="Saved"
              errorLabel="Try again"
              disabled={!canSubmit}
              className={`${DIALOG_ACTION_CLASS} px-5 font-medium bg-primary text-primary-foreground hover:bg-primary/80`}
            />
          </div>
    </motion.form>
  );
}
