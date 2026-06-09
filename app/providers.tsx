"use client";

import { MotionProvider } from "@/components/design-system/motion-provider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "border border-border bg-popover text-popover-foreground shadow-[0_24px_54px_-34px_color-mix(in_oklab,var(--ink)_70%,transparent)]",
            title: "text-sm font-medium",
            description: "text-xs text-muted-foreground",
            success:
              "border-[color-mix(in_oklab,var(--primary)_28%,var(--border))] [&_[data-icon]]:text-primary",
            error:
              "border-destructive/25 [&_[data-icon]]:text-destructive",
          },
        }}
      />
    </MotionProvider>
  );
}
