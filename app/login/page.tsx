"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { login, signup } from "@/lib/actions/auth";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/inline-error";
import { Label } from "@/components/ui/label";
import { motionVariants } from "@/lib/ui/motion";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("pending");

    const formData = new FormData(e.currentTarget);
    const result = await (mode === "login" ? login : signup)(formData);

    if (result?.error) {
      setError(result.error);
      setState("error");
      return;
    }
    setState("success");
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
                placeholder="Password"
                className="h-11 rounded-lg bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
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
              idleLabel={mode === "login" ? "Sign in" : "Create account"}
              pendingLabel={mode === "login" ? "Signing in" : "Creating account"}
              successLabel="Redirecting"
              errorLabel="Try again"
              className="primary-surface h-11 w-full rounded-lg text-[14px]"
            />
          </form>

          <p className="mt-7 text-center text-[13px] leading-relaxed text-muted-foreground">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setState("idle");
              }}
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
