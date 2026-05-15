"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { login } from "@/lib/actions/auth";
import { SIGNUPS_ENABLED } from "@/lib/auth/signup-enabled";
import { normalizeEmail } from "@/lib/auth/validation";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/password-field";
import { OtpConfirmationForm } from "@/components/auth/otp-confirmation-form";
import { motionVariants } from "@/lib/ui/motion";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);

  const isPending = state === "pending";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "");
    setError(null);
    setState("pending");

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
              {otpEmail ? "Confirm your email" : "Sign in"}
            </h1>
            {otpEmail && (
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Your email isn&apos;t confirmed yet. We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">{otpEmail}</span>.
              </p>
            )}
          </div>

          {otpEmail ? (
            <OtpConfirmationForm
              email={otpEmail}
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
                  placeholder="you@school.edu"
                  className="h-11 rounded-lg bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
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
                className="primary-surface h-11 w-full rounded-lg text-[14px]"
              />
            </form>
          )}

          {SIGNUPS_ENABLED && !otpEmail && (
            <p className="mt-7 text-center text-[13px] leading-relaxed text-muted-foreground">
              New here?{" "}
              <Link
                href="/register"
                className="font-medium text-foreground transition-colors duration-150 hover:text-primary"
              >
                Create an account
              </Link>
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
