"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { joinWaitlist } from "@/lib/actions/waitlist";
import { AsyncButton } from "@/components/ui/async-button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { InlineError } from "@/components/ui/inline-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEmailValidationError } from "@/lib/auth/validation";
import { motionVariants } from "@/lib/ui/motion";

export function WaitlistDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isPending = state === "pending";
  const isDone = state === "success";

  function reset() {
    setEmail("");
    setState("idle");
    setError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending || isDone) return;

    const validationError = getEmailValidationError(email);
    if (validationError) {
      setError(validationError);
      setState("error");
      return;
    }

    setState("pending");
    setError(null);

    const formData = new FormData();
    formData.set("email", email);

    const result = await joinWaitlist(formData).catch(() => ({
      error: "Something went wrong. Please try again.",
    }));

    if ("error" in result) {
      setError(result.error);
      setState("error");
      return;
    }

    setSuccessMessage(
      result.alreadyJoined
        ? "You're already on the list — we'll be in touch."
        : "You're on the list. We'll reach out when access opens.",
    );
    setState("success");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setTimeout(reset, 200);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "public-nav-button public-nav-button-primary"}
      >
        Join the waitlist <ArrowRight size={13} strokeWidth={1.8} />
      </button>

      <DialogContent
        showCloseButton
        className="sm:max-w-[460px] gap-0 p-8 sm:p-9"
      >
        <div>
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
            style={{
              borderColor: "color-mix(in oklab, var(--primary) 26%, var(--rule))",
              background:
                "linear-gradient(180deg, color-mix(in oklab, white 58%, transparent), transparent), color-mix(in oklab, var(--card) 86%, var(--primary) 8%)",
            }}
          >
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ background: "color-mix(in oklab, var(--primary) 80%, var(--foreground))" }}
              aria-hidden
            />
            Waitlist
          </span>

          <h2 className="display-serif mt-6 text-[1.85rem] leading-[1.1] text-foreground">
            Join the waitlist.
          </h2>

          <p className="mt-4 text-[14px] leading-[1.65] text-muted-foreground">
            Pathway is currently invite-only for{" "}
            <em className="font-medium not-italic text-foreground">@uw.edu</em>{" "}
            students. Add your email and we&apos;ll reach out as access opens.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="waitlist-email" className="label-meta">
              Email
            </Label>
            <Input
              id="waitlist-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={isPending || isDone}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (state === "error") setState("idle");
                setError(null);
              }}
              placeholder="you@example.com"
              className="h-10 rounded-lg bg-card px-3 text-[14px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
            />
          </div>

          <AnimatePresence mode="wait">
            {successMessage && (
              <motion.div
                key={successMessage}
                variants={motionVariants.fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                role="status"
                className="flex items-start gap-2 text-[12.5px] leading-relaxed text-foreground"
              >
                <CheckCircle2
                  className="mt-0.5 size-3.5 shrink-0"
                  style={{ color: "color-mix(in oklab, var(--primary) 80%, var(--foreground))" }}
                />
                <span>{successMessage}</span>
              </motion.div>
            )}
            {error && (
              <motion.div
                key={error}
                variants={motionVariants.fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <InlineError message={error} />
              </motion.div>
            )}
          </AnimatePresence>

          <AsyncButton
            type="submit"
            state={state}
            idleLabel="Join waitlist"
            pendingLabel="Joining"
            successLabel="You're in"
            errorLabel="Try again"
            disabled={isDone}
            className="primary-surface h-10 w-full rounded-lg text-[13.5px]"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
