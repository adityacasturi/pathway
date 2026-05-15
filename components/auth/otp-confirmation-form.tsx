"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { resendEmailOtp, verifyEmailOtp } from "@/lib/actions/auth";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import { motionVariants } from "@/lib/ui/motion";

export function OtpConfirmationForm({
  email,
  onExit,
  initialMessage,
}: {
  email: string;
  onExit: () => void;
  initialMessage?: string | null;
}) {
  const router = useRouter();
  const [otpCode, setOtpCode] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(initialMessage ?? null);
  const [resendState, setResendState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = window.setInterval(() => {
      setResendCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendCooldown]);

  const isPending = state === "pending";

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;

    const cleanCode = otpCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleanCode)) {
      setError("Enter the 6-digit code from your email.");
      setState("error");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setState("pending");

    const formData = new FormData();
    formData.set("email", email);
    formData.set("token", cleanCode);

    const result = await verifyEmailOtp(formData).catch(() => ({
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

  async function handleResend() {
    if (resendState === "pending" || isPending || resendCooldown > 0) return;

    setResendState("pending");
    setError(null);

    const formData = new FormData();
    formData.set("email", email);

    const result = await resendEmailOtp(formData).catch(() => ({
      error: "Something went wrong. Please try again.",
    }));

    if ("error" in result) {
      setError(result.error);
      setResendState("error");
      return;
    }

    setResendState("success");
    setSuccessMessage("We sent a new 6-digit code. Check your email.");
    setResendCooldown(60);
  }

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="otp" className="label-meta">
          6-digit code
        </Label>
        <Input
          id="otp"
          name="token"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          pattern="\d{6}"
          disabled={isPending}
          value={otpCode}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 6);
            setOtpCode(next);
            if (state === "error") setState("idle");
            setError(null);
          }}
          placeholder="123456"
          className="h-11 rounded-lg bg-card px-3 text-center text-[18px] tracking-[0.4em] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
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
        idleLabel="Confirm and sign in"
        pendingLabel="Verifying"
        successLabel="Redirecting"
        errorLabel="Try again"
        disabled={otpCode.length !== 6}
        className="primary-surface h-11 w-full rounded-lg text-[14px]"
      />

      <div className="flex items-center justify-between text-[13px] text-muted-foreground">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendState === "pending" || isPending || resendCooldown > 0}
          className="font-medium text-foreground transition-colors duration-150 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          {resendState === "pending"
            ? "Sending…"
            : resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend code"}
        </button>
        <button
          type="button"
          onClick={onExit}
          disabled={isPending}
          className="font-medium text-foreground transition-colors duration-150 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          Use a different email
        </button>
      </div>
    </form>
  );
}
