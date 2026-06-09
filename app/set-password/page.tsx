"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { setPassword } from "@/lib/actions/auth";
import {
  getSignupPasswordError,
  getSignupPasswordRules,
} from "@/lib/auth/validation";
import { AsyncButton } from "@/components/ui/async-button";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import {
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthHelpText,
  AuthPageHeader,
  AuthPageShell,
} from "@/components/auth/auth-page";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordQualityPanel } from "@/components/auth/password-quality-panel";
import { motionVariants } from "@/lib/ui/motion";

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
    router.replace("/applications");
    router.refresh();
  }

  return (
    <AuthPageShell>
      <AuthPageHeader title="Set your password">
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Pick a password to finish setting up your account.
        </p>
      </AuthPageHeader>

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
          <PasswordQualityPanel id="set-password-rules" rules={passwordRules} />
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
          <AuthHelpText
            id="set-password-confirmation-help"
            tone={passwordsDoNotMatch ? "error" : passwordsMatch ? "success" : "muted"}
          >
            {passwordsDoNotMatch
              ? "Passwords do not match."
              : passwordsMatch
                ? "Passwords match."
                : "Type your password again."}
          </AuthHelpText>
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
          className={AUTH_PRIMARY_BUTTON_CLASS}
        />
      </form>
    </AuthPageShell>
  );
}
