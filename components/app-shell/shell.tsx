"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-shell/sidebar";
import {
  NavigationPendingGate,
  NavigationPendingOverlay,
  NavigationPendingProvider,
  useNavigationPending,
} from "@/components/app-shell/navigation-pending";
import { CommandPalette } from "@/components/design-system/command-palette";
import { APP_SHELL_CSS_VARS } from "@/components/app-shell/shell-layout";
import { AppTopBar } from "@/components/app-shell/top-bar";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string | null;
}) {
  return (
    <AppShellFrame userEmail={userEmail}>{children}</AppShellFrame>
  );
}

function AppShellFrame({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string | null;
}) {
  return (
    <NavigationPendingProvider>
      <div
        className="flex h-dvh flex-col overflow-hidden overscroll-none bg-background"
        style={APP_SHELL_CSS_VARS}
      >
        <AppTopBar userEmail={userEmail} />
        <div className="relative min-h-0 flex-1">
          <AppSidebar userEmail={userEmail} />
          <ContentArea>
            <NavigationPendingGate>
              <div className="h-full min-h-0">{children}</div>
            </NavigationPendingGate>
          </ContentArea>
        </div>
      </div>
      <CommandPalette />
    </NavigationPendingProvider>
  );
}

function ContentArea({ children }: { children: ReactNode }) {
  const { pendingHref } = useNavigationPending();
  const navigating = Boolean(pendingHref);

  return (
    <div
      className={cn(
        "relative z-0 h-full overflow-y-auto overscroll-y-none bg-background md:pl-[var(--app-sidebar-width)]",
        navigating && "pointer-events-none",
      )}
      aria-busy={navigating || undefined}
    >
      <NavigationPendingOverlay />
      <div className={cn("h-full min-h-0", navigating && "invisible")}>{children}</div>
    </div>
  );
}
