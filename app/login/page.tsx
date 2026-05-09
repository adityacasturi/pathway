"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { login, signup } from "@/lib/actions/auth";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import { motionVariants } from "@/lib/ui/motion";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const isPending = state === "pending";
  const isAwaitingConfirmation = Boolean(successMessage);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending || isAwaitingConfirmation) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const actionMode = mode;

    setError(null);
    setSuccessMessage(null);
    setState("pending");

    const result = await (actionMode === "login" ? login : signup)(formData).catch(() => ({
      error: "Something went wrong. Please try again.",
    }));

    if ("error" in result) {
      setError(result.error);
      setState("error");
      return;
    }

    if ("status" in result && result.status === "confirmation_required") {
      setSuccessMessage("Account created. Check your email to confirm your account, then sign in.");
      setState("success");
      return;
    }

    if (!("status" in result) || result.status !== "authenticated") {
      setError("Something went wrong. Please try again.");
      setState("error");
      return;
    }

    setState("success");
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12 sm:px-8">
        <motion.div
          className="w-full"
          variants={motionVariants.riseIn}
          initial="hidden"
          animate="visible"
        >
          <div className="mb-10">
            <p className="label-micro">Launchpad</p>
            <h1 className="display-serif mt-5 text-[2.25rem] text-foreground">
              {mode === "login" ? "Sign in" : "Create account"}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="label-meta">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                disabled={isPending || isAwaitingConfirmation}
                placeholder="you@example.com"
                className="h-11 rounded-lg bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="label-meta">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                disabled={isPending || isAwaitingConfirmation}
                placeholder="Password"
                className="h-11 rounded-lg bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
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
                  className="flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="size-3.5 shrink-0" />
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
              idleLabel={mode === "login" ? "Sign in" : "Create account"}
              pendingLabel={mode === "login" ? "Signing in" : "Creating account"}
              successLabel={successMessage ? "Email sent" : "Redirecting"}
              errorLabel="Try again"
              disabled={isAwaitingConfirmation}
              className="primary-surface h-11 w-full rounded-lg text-[14px]"
            />
          </form>

          <p className="mt-7 text-center text-[13px] leading-relaxed text-muted-foreground">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                if (isPending) return;
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setSuccessMessage(null);
                setState("idle");
              }}
              disabled={isPending}
              className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
            >
              {mode === "login" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
