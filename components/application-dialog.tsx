"use client";

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
import { motionVariants } from "@/lib/ui/motion";
import { APPLICATION_SEASONS, ApplicationSeason } from "@/types/application";

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
        className="max-w-md gap-0 rounded-md border bg-popover p-8"
        style={{ borderColor: "var(--rule-strong)" }}
      >
        <DialogHeader className="mb-7">
          <span className="label-micro mb-3 block">New entry</span>
          <span className="rule-strong mb-5" />
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
  // Season has no native input primitive that fits the design, so it rides
  // alongside the rest of the form as component state and is submitted via a
  // hidden input. Empty string = no season set.
  const [season, setSeason] = useState<"" | ApplicationSeason>(initialValues?.season ?? "");

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

    const formData = new FormData();
    formData.set("company", company);
    formData.set("role", role);
    formData.set("posting_url", postingUrl);
    formData.set("location", location);
    formData.set("season", season);
    const dateApplied = format(new Date(), "yyyy-MM-dd");
    formData.set("date_applied", dateApplied);

    setState("pending");
    const result = await createApplication(formData, { revalidate: !onCreated });

    if (result?.error) {
      setError(result.error);
      setState("error");
    } else {
      setState("success");
      if (onCreated) {
        onCreated({
          id: result.id,
          company: trimmedCompany,
          role: trimmedRole,
          postingUrl: postingUrl.trim() || null,
          location: location.trim() || null,
          season: season || null,
          dateApplied,
        });
      } else {
        router.refresh();
      }
      onClose();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Company</Label>
            <Input
                name="company"
              required
              placeholder="Acme Corp"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="h-11 rounded-xl text-sm bg-background/80 border-border/70 placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Role</Label>
            <Input
              name="role"
              required
              placeholder="Rocket Skate Engineer Intern"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="h-11 rounded-xl text-sm bg-background/80 border-border/70 placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
              Posting URL <span className="normal-case tracking-normal text-muted-foreground/40">(optional)</span>
            </Label>
            <Input
              name="posting_url"
              type="url"
              placeholder="https://acme.com/careers/rocket-skate-intern"
              value={postingUrl}
              onChange={(event) => setPostingUrl(event.target.value)}
              className="h-11 rounded-xl text-sm bg-background/80 border-border/70 placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2 min-w-0">
              <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                Location <span className="normal-case tracking-normal text-muted-foreground/40">(optional)</span>
              </Label>
              <Input
                name="location"
                placeholder="New York · Seattle"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="h-11 rounded-xl text-sm bg-background/80 border-border/70 placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                Season
              </Label>
              {/* Tri-state segmented control: none / summer / fall. Clicking
                  the active choice clears it so there's no "reset" button. */}
              <input type="hidden" name="season" value={season} />
              <div
                className="inline-flex h-11 rounded-md border bg-background"
                style={{ borderColor: "var(--rule)" }}
              >
                {(["", ...APPLICATION_SEASONS] as const).map((option, idx) => {
                  const active = season === option;
                  const label = option === "" ? "—" : option;
                  return (
                    <button
                      key={option || "none"}
                      type="button"
                      onClick={() => setSeason(option)}
                      aria-pressed={active}
                      className={`px-3.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 ${
                        idx > 0 ? "border-l" : ""
                      } ${
                        active
                          ? "bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      style={idx > 0 ? { borderColor: "var(--rule)" } : undefined}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div variants={motionVariants.fadeIn} initial="hidden" animate="visible" exit="hidden">
                <InlineError message={error} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-9 px-4 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-200"
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
              className="h-9 px-5 text-xs uppercase tracking-wider font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors duration-200"
            />
          </div>
    </form>
  );
}
