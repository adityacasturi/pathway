"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { login, signup } from "@/lib/actions/auth";
import {
  type PasswordRule,
  getEmailValidationError,
  getSignupPasswordError,
  getSignupPasswordRules,
  isSignupPasswordValid,
} from "@/lib/auth/validation";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import { motionVariants } from "@/lib/ui/motion";

const SCHOOL_LOGOS = [
  { name: "University of Washington", src: "/school-logos/uw.svg" },
  { name: "MIT", src: "/school-logos/mit.svg" },
  { name: "UC San Diego", src: "/school-logos/ucsd.svg" },
  { name: "University of Maryland", src: "/school-logos/umd.svg" },
  { name: "Georgia Tech", src: "/school-logos/gatech.svg" },
] as const;

function SchoolLogoCarousel() {
  const logos = [...SCHOOL_LOGOS, ...SCHOOL_LOGOS];

  return (
    <section className="mt-11" aria-label="Universities using Launchpad">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <p className="label-micro shrink-0">Used by students at</p>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <div className="school-logo-fade overflow-hidden">
        <div className="school-logo-track flex w-max items-center gap-8">
          {logos.map((school, index) => (
            // Plain <img> because these are static local assets.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${school.src}-${index}`}
              src={school.src}
              alt={index >= SCHOOL_LOGOS.length ? "" : `${school.name} logo`}
              width={112}
              height={36}
              loading="lazy"
              decoding="async"
              className="h-8 max-w-32 shrink-0 object-contain opacity-80 grayscale transition duration-200 hover:opacity-100 hover:grayscale-0"
              aria-hidden={index >= SCHOOL_LOGOS.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function getPasswordQualityLabel(metCount: number, total: number) {
  if (metCount === total) return "Ready";
  if (metCount >= total - 1) return "Almost there";
  if (metCount >= 3) return "Getting stronger";
  return "Needs work";
}

function PasswordQualityPanel({ rules }: { rules: PasswordRule[] }) {
  const visibleRules = rules.filter((rule) => rule.id !== "email" || !rule.met);
  const metCount = visibleRules.filter((rule) => rule.met).length;
  const quality = Math.round((metCount / visibleRules.length) * 100);
  const missingRules = rules.filter((rule) => !rule.met);
  const isComplete = missingRules.length === 0;
  const label = isComplete ? "Ready" : getPasswordQualityLabel(metCount, visibleRules.length);

  return (
    <motion.div
      id="signup-password-rules"
      layout
      className="rounded-lg border bg-background/70 p-3"
      style={{ borderColor: quality === 100 ? "color-mix(in oklab, var(--primary) 28%, var(--rule))" : "var(--rule)" }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 36, mass: 0.7 } }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
              quality === 100 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {quality === 100 ? <CheckCircle2 className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">8+ chars with A/a/1/!</p>
          </div>
        </div>
        <span className="font-mono text-[11px] tabular text-muted-foreground">
          {metCount}/{visibleRules.length}
        </span>
      </div>

      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${visibleRules.length}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {visibleRules.map((rule) => (
          <motion.span
            key={rule.id}
            layout
            className={`h-1 rounded-full transition-colors duration-200 ${
              rule.met ? "bg-primary" : "bg-[color-mix(in_oklab,var(--ink)_9%,transparent)]"
            }`}
          />
        ))}
      </div>

      <AnimatePresence initial={false} mode="wait">
        <motion.p
          key={isComplete ? "complete" : missingRules.map((rule) => rule.id).join("-")}
          variants={motionVariants.step}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`mt-3 text-[12px] leading-relaxed ${
            isComplete ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {isComplete
            ? "Your password is strong enough."
            : `Add ${missingRules.map((rule) => rule.label.toLowerCase()).join(", ")}.`}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const isPending = state === "pending";
  const isAwaitingConfirmation = Boolean(successMessage);
  const signupEmailError = useMemo(
    () => (mode === "signup" && email ? getEmailValidationError(email) : null),
    [email, mode],
  );
  const passwordRules = useMemo(() => getSignupPasswordRules(password, email), [email, password]);
  const isSignupReady =
    mode !== "signup" ||
    (email.length > 0 &&
      password.length > 0 &&
      !getEmailValidationError(email) &&
      isSignupPasswordValid(password, email));
  const isSubmitDisabled = isAwaitingConfirmation || (mode === "signup" && !isSignupReady);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending || isAwaitingConfirmation) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const actionMode = mode;

    setError(null);
    setSuccessMessage(null);

    if (actionMode === "signup") {
      const submittedEmail = String(formData.get("email") ?? "");
      const submittedPassword = String(formData.get("password") ?? "");
      const validationError =
        getEmailValidationError(submittedEmail) ?? getSignupPasswordError(submittedPassword, submittedEmail);

      if (validationError) {
        setError(validationError);
        setState("error");
        return;
      }
    }

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
          initial={false}
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
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (state === "error") setState("idle");
                  setError(null);
                }}
                aria-invalid={Boolean(signupEmailError)}
                aria-describedby={mode === "signup" ? "signup-email-help" : undefined}
                placeholder="you@example.com"
                className="h-11 rounded-lg bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
              />
              {mode === "signup" && (
                <p
                  id="signup-email-help"
                  className={`text-[12px] leading-relaxed ${
                    signupEmailError ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {signupEmailError ?? "Use a real, permanent email address."}
                </p>
              )}
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
                minLength={mode === "signup" ? 8 : undefined}
                pattern={mode === "signup" ? "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$" : undefined}
                title={
                  mode === "signup"
                    ? "Use at least 8 characters with lowercase, uppercase, number, and symbol."
                    : undefined
                }
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                disabled={isPending || isAwaitingConfirmation}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (state === "error") setState("idle");
                  setError(null);
                }}
                aria-invalid={
                  mode === "signup" && password.length > 0 && passwordRules.some((rule) => !rule.met)
                }
                aria-describedby={mode === "signup" ? "signup-password-rules" : undefined}
                placeholder="Password"
                className="h-11 rounded-lg bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
              />
              {mode === "signup" && <PasswordQualityPanel rules={passwordRules} />}
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
              disabled={isSubmitDisabled}
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

          <SchoolLogoCarousel />
        </motion.div>
      </main>
    </div>
  );
}
