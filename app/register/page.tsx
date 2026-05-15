"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { signup } from "@/lib/actions/auth";
import { SIGNUPS_ENABLED } from "@/lib/auth/signup-enabled";
import {
  getSignupEmailValidationError,
  getSignupPasswordError,
  getSignupPasswordRules,
} from "@/lib/auth/validation";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordQualityPanel } from "@/components/auth/password-quality-panel";
import { OtpConfirmationForm } from "@/components/auth/otp-confirmation-form";
import { motionVariants } from "@/lib/ui/motion";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);

  const isPending = state === "pending";
  const isAwaitingConfirmation = Boolean(otpEmail);
  const signupEmailError = useMemo(
    () => (email ? getSignupEmailValidationError(email) : null),
    [email],
  );
  const passwordRules = useMemo(() => getSignupPasswordRules(password, email), [email, password]);
  const passwordsDoNotMatch =
    passwordConfirmation.length > 0 && password !== passwordConfirmation;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending || isAwaitingConfirmation) return;

    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "");
    const submittedPassword = String(formData.get("password") ?? "");
    const submittedPasswordConfirmation = String(formData.get("password_confirmation") ?? "");

    setError(null);
    setSuccessMessage(null);

    const validationError =
      getSignupEmailValidationError(submittedEmail) ??
      getSignupPasswordError(submittedPassword, submittedEmail) ??
      (submittedPassword !== submittedPasswordConfirmation ? "Passwords do not match." : null);

    if (validationError) {
      setError(validationError);
      setState("error");
      return;
    }

    setState("pending");

    const result = await signup(formData).catch(() => ({
      error: "Something went wrong. Please try again.",
    }));

    if ("error" in result) {
      setError(result.error);
      setState("error");
      return;
    }

    if ("status" in result && result.status === "confirmation_required") {
      setOtpEmail(submittedEmail.trim().toLowerCase());
      setSuccessMessage("We sent a 6-digit code to your email. Enter it below to continue.");
      setState("idle");
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

  if (!SIGNUPS_ENABLED) {
    return (
      <div className="page-shell min-h-screen bg-background">
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12 sm:px-8">
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
            <h1 className="display-serif mt-5 text-[2.25rem] text-foreground">Signups paused</h1>
            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
              Public signups are temporarily paused. Join the waitlist from the home page to be
              notified when they reopen.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex font-medium text-foreground transition-colors duration-150 hover:text-primary"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
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
              {otpEmail ? "Confirm your email" : "Create account"}
            </h1>
            {otpEmail && (
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">{otpEmail}</span>.
              </p>
            )}
          </div>

          {otpEmail ? (
            <OtpConfirmationForm
              email={otpEmail}
              onExit={() => {
                setOtpEmail(null);
                setSuccessMessage(null);
                setError(null);
                setState("idle");
              }}
              initialMessage={successMessage}
            />
          ) : (
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
                  pattern=".+\.[eE][dD][uU]"
                  title="Use your school .edu email."
                  disabled={isPending}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (state === "error") setState("idle");
                    setError(null);
                  }}
                  aria-invalid={Boolean(signupEmailError)}
                  aria-describedby="signup-email-help"
                  placeholder="you@school.edu"
                  className="h-11 rounded-lg bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
                />
                <p
                  id="signup-email-help"
                  className={`text-[12px] leading-relaxed ${
                    signupEmailError ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {signupEmailError ?? "Use your school .edu email."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="label-meta">
                  Password
                </Label>
                <PasswordField
                  id="password"
                  name="password"
                  minLength={8}
                  pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$"
                  title="Use at least 8 characters with lowercase, uppercase, number, and symbol."
                  autoComplete="new-password"
                  disabled={isPending}
                  value={password}
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((value) => !value)}
                  onChange={(nextValue) => {
                    setPassword(nextValue);
                    if (state === "error") setState("idle");
                    setError(null);
                  }}
                  ariaInvalid={password.length > 0 && passwordRules.some((rule) => !rule.met)}
                  ariaDescribedBy="signup-password-rules"
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
                idleLabel="Create account"
                pendingLabel="Creating account"
                successLabel="Redirecting"
                errorLabel="Try again"
                className="primary-surface h-11 w-full rounded-lg text-[14px]"
              />
            </form>
          )}

          {!otpEmail && (
            <p className="mt-7 text-center text-[13px] leading-relaxed text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
              >
                Sign in instead
              </Link>
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
