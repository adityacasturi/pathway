"use client";

import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { login, sendPasswordReset } from "@/lib/actions/auth";
import { SIGNUPS_ENABLED } from "@/lib/auth/signup-enabled";
import { normalizeEmail } from "@/lib/auth/validation";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import {
  AUTH_FOOTER_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LINK_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthPageHeader,
  AuthPageShell,
} from "@/components/auth/auth-page";
import { PasswordField } from "@/components/auth/password-field";
import { OtpConfirmationForm } from "@/components/auth/otp-confirmation-form";
import { DEFAULT_AUTH_HREF } from "@/lib/config/nav";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import { motionVariants } from "@/lib/ui/motion";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <AuthPageShell>
      <AuthPageHeader title="Sign in" />
    </AuthPageShell>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeInternalPath(searchParams.get("next"), DEFAULT_AUTH_HREF, {
    blockedPrefixes: ["/login", "/register"],
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [resetState, setResetState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);

  const isPending = state === "pending";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "");
    setError(null);
    setState("pending");
    setResetMessage(null);

    const result = await login(formData).catch(() => ({
      error: "Something went wrong. Please try again.",
    }));

    if ("error" in result) {
      setError(result.error);
      setState("error");
      return;
    }

    if ("status" in result && result.status === "confirmation_required") {
      setOtpEmail(normalizeEmail(submittedEmail));
      setState("idle");
      return;
    }

    if (!("status" in result) || result.status !== "authenticated") {
      setError("Something went wrong. Please try again.");
      setState("error");
      return;
    }

    setState("success");
    router.replace(nextPath);
    router.refresh();
  }

  async function handlePasswordReset(form: HTMLFormElement) {
    if (resetState === "pending" || isPending) return;
    const formData = new FormData(form);
    setError(null);
    setResetMessage(null);
    setResetState("pending");

    const result = await sendPasswordReset(formData).catch(() => ({
      error: "Something went wrong. Please try again.",
    }));

    if ("error" in result) {
      setError(result.error);
      setResetState("error");
      return;
    }

    setResetState("success");
    setResetMessage("If an account exists for that email, a reset link is on the way.");
  }

  return (
    <AuthPageShell>
      <AuthPageHeader title={otpEmail ? "Confirm your email" : "Sign in"}>
        {otpEmail && (
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Your email isn&apos;t confirmed yet. We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{otpEmail}</span>.
          </p>
        )}
        {!otpEmail && nextPath !== DEFAULT_AUTH_HREF ? (
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Sign in to continue to your requested page.
          </p>
        ) : null}
      </AuthPageHeader>

      {otpEmail ? (
        <OtpConfirmationForm
          email={otpEmail}
          nextPath={nextPath}
          onExit={() => {
            setOtpEmail(null);
            setError(null);
            setState("idle");
          }}
          initialMessage="We sent a fresh 6-digit code. Enter it below to finish signing in."
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
              disabled={isPending}
              onChange={() => {
                if (state === "error") setState("idle");
                setError(null);
              }}
              placeholder="you@example.com"
              className={AUTH_INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="label-meta">
              Password
            </Label>
            <PasswordField
              id="password"
              name="password"
              autoComplete="current-password"
              disabled={isPending}
              value={password}
              visible={showPassword}
              onToggleVisible={() => setShowPassword((value) => !value)}
              onChange={(nextValue) => {
                setPassword(nextValue);
                if (state === "error") setState("idle");
                setError(null);
              }}
            />
          </div>

          <AnimatePresence mode="wait">
            {resetMessage && (
              <motion.div
                key={resetMessage}
                variants={motionVariants.fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                role="status"
                className="rounded-lg border bg-card px-3 py-3 text-[12px] leading-relaxed text-foreground"
                style={{
                  borderColor: "color-mix(in oklab, var(--primary) 18%, var(--rule))",
                  background: "color-mix(in oklab, var(--primary) 4%, var(--card))",
                }}
              >
                {resetMessage}
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
            idleLabel="Sign in"
            pendingLabel="Signing in"
            successLabel="Redirecting"
            errorLabel="Try again"
            className={AUTH_PRIMARY_BUTTON_CLASS}
          />
          <button
            type="button"
            disabled={isPending || resetState === "pending"}
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) void handlePasswordReset(form);
            }}
            className="w-full text-center text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {resetState === "pending" ? "Sending reset link..." : "Forgot password?"}
          </button>
        </form>
      )}

      {SIGNUPS_ENABLED && !otpEmail && (
        <p className={AUTH_FOOTER_CLASS}>
          New here?{" "}
          <Link href="/register" className={AUTH_LINK_CLASS}>
            Create an account
          </Link>
        </p>
      )}
    </AuthPageShell>
  );
}
