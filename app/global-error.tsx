"use client";

import { useEffect } from "react";
import { InlineError } from "@/components/ui/inline-error";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="w-full max-w-lg space-y-4">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Launchpad</p>
          <h1 className="text-2xl font-semibold tracking-tight">We hit an unexpected issue.</h1>
          <InlineError message="The app is still safe. Please retry this page." onRetry={reset} />
          <Button variant="outline" onClick={reset} className="h-9 text-xs uppercase tracking-wider">
            Retry
          </Button>
        </div>
      </body>
    </html>
  );
}
