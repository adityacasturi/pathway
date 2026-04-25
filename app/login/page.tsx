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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        className="w-full max-w-sm px-8"
        variants={motionVariants.riseIn}
        initial="hidden"
        animate="visible"
      >

        <div className="mb-12">
          <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-medium">
            Launchpad
          </span>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="h-11 text-base bg-muted border-border placeholder:text-muted-foreground/40 transition-colors duration-200 focus:bg-background focus:border-foreground/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="h-11 text-base bg-muted border-border placeholder:text-muted-foreground/40 transition-colors duration-200 focus:bg-background focus:border-foreground/30"
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
            className="w-full h-11 text-sm tracking-wider uppercase font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors duration-200"
          >
          </AsyncButton>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          {mode === "login" ? "No account?" : "Have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setState("idle");
            }}
            className="text-foreground/70 hover:text-foreground font-medium transition-colors duration-200 underline underline-offset-2"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
