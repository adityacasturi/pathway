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
      <main className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:px-16">
        <motion.section
          className="flex min-h-[42vh] flex-col justify-end pb-12 pt-12 lg:min-h-screen lg:pr-16 lg:pb-24"
          variants={motionVariants.riseIn}
          initial="hidden"
          animate="visible"
        >
          <div className="masthead max-w-3xl">
            <div className="flex items-baseline justify-between pb-4">
              <span className="label-micro">Launchpad</span>
            </div>
            <span className="rule-strong" />
            <h1 className="display-serif mt-8 max-w-2xl text-[4.75rem] leading-none text-foreground sm:text-[6.5rem]">
              Launchpad
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              A quiet place to track your internship search.
            </p>
          </div>
        </motion.section>

        <motion.section
          className="flex items-center pb-14 lg:pb-0"
          variants={motionVariants.fadeIn}
          initial="hidden"
          animate="visible"
        >
          <div className="w-full">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <span className="label-micro">Account</span>
                <h2 className="display-serif mt-3 text-[2rem] text-foreground">
                  {mode === "login" ? "Sign in" : "Create account"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                  setState("idle");
                }}
                className="shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                style={{ borderColor: "var(--rule)" }}
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </div>

            <span className="rule mb-6" />

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
                  className="h-11 rounded-xl bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
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
                  className="h-11 rounded-xl bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
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
                className="primary-surface h-11 w-full rounded-full text-[13px]"
              />
            </form>

            <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
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
          </div>
        </motion.section>
      </main>
    </div>
  );
}
