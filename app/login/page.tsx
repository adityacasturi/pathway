"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { login, signup } from "@/lib/actions/auth";
import {
  type PasswordRule,
  getSignupEmailValidationError,
  getSignupPasswordError,
  getSignupPasswordRules,
} from "@/lib/auth/validation";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import { motionVariants } from "@/lib/ui/motion";

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

function PasswordField({
  id,
  name,
  value,
  visible,
  disabled,
  autoComplete,
  ariaDescribedBy,
  ariaInvalid,
  minLength,
  pattern,
  title,
  onChange,
  onToggleVisible,
}: {
  id: string;
  name: string;
  value: string;
  visible: boolean;
  disabled: boolean;
  autoComplete: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  minLength?: number;
  pattern?: string;
  title?: string;
  onChange: (value: string) => void;
  onToggleVisible: () => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        pattern={pattern}
        title={title}
        autoComplete={autoComplete}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        placeholder="Password"
        className="h-11 rounded-lg bg-card px-3 pr-11 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
      />
      <button
        type="button"
        onClick={onToggleVisible}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const isPending = state === "pending";
  const isAwaitingConfirmation = Boolean(successMessage);
  const signupEmailError = useMemo(
    () => (mode === "signup" && email ? getSignupEmailValidationError(email) : null),
    [email, mode],
  );
  const passwordRules = useMemo(() => getSignupPasswordRules(password, email), [email, password]);
  const passwordsDoNotMatch =
    mode === "signup" && passwordConfirmation.length > 0 && password !== passwordConfirmation;
  const isSubmitDisabled = isAwaitingConfirmation;

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
      const submittedPasswordConfirmation = String(formData.get("password_confirmation") ?? "");
      const validationError =
        getSignupEmailValidationError(submittedEmail) ??
        getSignupPasswordError(submittedPassword, submittedEmail) ??
        (submittedPassword !== submittedPasswordConfirmation ? "Passwords do not match." : null);

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
    router.replace("/home");
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
            <Link href="/" aria-label="Pathway home" className="inline-flex items-center">
              <Image
                src="/brand/pathway-logo-black-transparent-600w.png"
                alt="Pathway"
                width={600}
                height={148}
                priority
                className="brand-wordmark h-[36px] w-auto sm:h-[40px]"
              />
            </Link>
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
                pattern={mode === "signup" ? ".+@[uU][wW]\\.[eE][dD][uU]" : undefined}
                title={mode === "signup" ? "Use your @uw.edu email for now." : undefined}
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
                  {signupEmailError ?? "Use your @uw.edu email for now."}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="label-meta">
                Password
              </Label>
              <PasswordField
                id="password"
                name="password"
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
                visible={showPassword}
                onToggleVisible={() => setShowPassword((value) => !value)}
                onChange={(nextValue) => {
                  setPassword(nextValue);
                  if (state === "error") setState("idle");
                  setError(null);
                }}
                ariaInvalid={
                  mode === "signup" && password.length > 0 && passwordRules.some((rule) => !rule.met)
                }
                ariaDescribedBy={mode === "signup" ? "signup-password-rules" : undefined}
              />
              {mode === "signup" && <PasswordQualityPanel rules={passwordRules} />}
            </div>

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="password_confirmation" className="label-meta">
                  Confirm password
                </Label>
                <PasswordField
                  id="password_confirmation"
                  name="password_confirmation"
                  autoComplete="new-password"
                  disabled={isPending || isAwaitingConfirmation}
                  value={passwordConfirmation}
                  visible={showPasswordConfirmation}
                  onToggleVisible={() => setShowPasswordConfirmation((value) => !value)}
                  onChange={(nextValue) => {
                    setPasswordConfirmation(nextValue);
                    if (state === "error") setState("idle");
                    setError(null);
                  }}
                  ariaInvalid={passwordsDoNotMatch}
                  ariaDescribedBy="signup-password-confirmation-help"
                />
                <p
                  id="signup-password-confirmation-help"
                  className={`text-[12px] leading-relaxed ${
                    passwordsDoNotMatch
                      ? "text-destructive"
                      : passwordConfirmation.length > 0 && password === passwordConfirmation
                        ? "text-[color-mix(in_oklab,#2f7d5b_88%,var(--foreground))]"
                        : "text-muted-foreground"
                  }`}
                >
                  {passwordsDoNotMatch
                    ? "Passwords do not match."
                    : passwordConfirmation.length > 0 && password === passwordConfirmation
                      ? "Passwords match."
                      : "Type your password again."}
                </p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {successMessage && (
                <motion.div
                  key={successMessage}
                  variants={motionVariants.fadeIn}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  role="status"
                  className="flex items-start gap-2 rounded-lg border bg-card px-3 py-3 text-[12px] leading-relaxed text-foreground"
                  style={{
                    borderColor: "color-mix(in oklab, var(--primary) 18%, var(--rule))",
                    background: "color-mix(in oklab, var(--primary) 4%, var(--card))",
                  }}
                >
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
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

          <form
            action="/login"
            method="get"
            className="mt-7 text-center text-[13px] leading-relaxed text-muted-foreground"
          >
            {mode === "login" ? <input type="hidden" name="mode" value="signup" /> : null}
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="submit"
              onClick={(event) => {
                if (isPending) return;
                event.preventDefault();
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setSuccessMessage(null);
                setPasswordConfirmation("");
                setShowPassword(false);
                setShowPasswordConfirmation(false);
                setState("idle");
              }}
              disabled={isPending}
              className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
            >
              {mode === "login" ? "Create an account" : "Sign in instead"}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
