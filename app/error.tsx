"use client";

import { useEffect } from "react";
import { InlineError } from "@/components/ui/inline-error";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-lg space-y-4">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Launchpad</p>
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong.</h1>
        <InlineError
          message="A temporary issue interrupted this page."
          onRetry={reset}
        />
        <Button variant="outline" onClick={reset} className="h-9 text-xs uppercase tracking-wider">
          Reload view
        </Button>
      </div>
    </div>
  );
}
