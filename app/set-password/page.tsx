"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { setPassword } from "@/lib/actions/auth";
import {
  type PasswordRule,
  getSignupPasswordError,
  getSignupPasswordRules,
} from "@/lib/auth/validation";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import { motionVariants } from "@/lib/ui/motion";

function getQualityLabel(metCount: number, total: number) {
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
  const label = isComplete ? "Ready" : getQualityLabel(metCount, visibleRules.length);

  return (
    <motion.div
      id="set-password-rules"
      layout
      className="rounded-lg border bg-background/70 p-3"
      style={{
        borderColor:
          quality === 100
            ? "color-mix(in oklab, var(--primary) 28%, var(--rule))"
            : "var(--rule)",
      }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 36, mass: 0.7 } }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
              quality === 100 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {quality === 100 ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
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
        minLength={8}
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

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPasswordValue] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");

  const isPending = state === "pending";
  const passwordRules = useMemo(() => getSignupPasswordRules(password, ""), [password]);
  const allRulesMet = passwordRules.every((rule) => rule.met);
  const passwordsMatch = password.length > 0 && password === passwordConfirmation;
  const passwordsDoNotMatch =
    passwordConfirmation.length > 0 && password !== passwordConfirmation;

  function clearError() {
    if (state === "error") setState("idle");
    if (error) setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const validationError =
      getSignupPasswordError(password, "") ??
      (password !== passwordConfirmation ? "Passwords do not match." : null);
    if (validationError) {
      setError(validationError);
      setState("error");
      return;
    }

    setError(null);
    setState("pending");

    const formData = new FormData();
    formData.set("password", password);
    formData.set("password_confirmation", passwordConfirmation);

    const result = await setPassword(formData).catch(() => ({
      error: "Something went wrong. Please try again.",
    }));

    if ("error" in result) {
      setError(result.error);
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
              Set your password
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Pick a password to finish setting up your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="label-meta">
                New password
              </Label>
              <PasswordField
                id="password"
                name="password"
                autoComplete="new-password"
                disabled={isPending}
                value={password}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((value) => !value)}
                onChange={(value) => {
                  setPasswordValue(value);
                  clearError();
                }}
                ariaInvalid={password.length > 0 && !allRulesMet}
                ariaDescribedBy="set-password-rules"
              />
              <PasswordQualityPanel rules={passwordRules} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password_confirmation" className="label-meta">
                Confirm password
              </Label>
              <PasswordField
                id="password_confirmation"
                name="password_confirmation"
                autoComplete="new-password"
                disabled={isPending}
                value={passwordConfirmation}
                visible={showPasswordConfirmation}
                onToggleVisible={() => setShowPasswordConfirmation((value) => !value)}
                onChange={(value) => {
                  setPasswordConfirmation(value);
                  clearError();
                }}
                ariaInvalid={passwordsDoNotMatch}
                ariaDescribedBy="set-password-confirmation-help"
              />
              <p
                id="set-password-confirmation-help"
                className={`text-[12px] leading-relaxed ${
                  passwordsDoNotMatch
                    ? "text-destructive"
                    : passwordsMatch
                      ? "text-[color-mix(in_oklab,#2f7d5b_88%,var(--foreground))]"
                      : "text-muted-foreground"
                }`}
              >
                {passwordsDoNotMatch
                  ? "Passwords do not match."
                  : passwordsMatch
                    ? "Passwords match."
                    : "Type your password again."}
              </p>
            </div>

            <AnimatePresence mode="wait">
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
              idleLabel="Save password"
              pendingLabel="Saving"
              successLabel="Redirecting"
              errorLabel="Try again"
              disabled={!allRulesMet || !passwordsMatch}
              className="primary-surface h-11 w-full rounded-lg text-[14px]"
            />
          </form>
        </motion.div>
      </main>
    </div>
  );
}
