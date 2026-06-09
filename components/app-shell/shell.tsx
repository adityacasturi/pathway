"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Dog,
  Home,
  LayoutGrid,
  Lock,
  Radio,
} from "lucide-react";
import { MobileMoreNav } from "@/components/app-shell/mobile-more-nav";
import { AppSidebar } from "@/components/app-shell/sidebar";
import {
  NavigationPendingGate,
  NavigationPendingOverlay,
  NavigationPendingProvider,
  useDisplayNavHref,
  useNavigationPending,
} from "@/components/app-shell/navigation-pending";
import { CommandPalette } from "@/components/design-system/command-palette";
import { APP_SHELL_CSS_VARS } from "@/components/app-shell/shell-layout";
import { AppTopBar } from "@/components/app-shell/top-bar";
import { SCOUT_ENABLED, SCOUT_LOCKED_COPY } from "@/lib/config/scout";
import { type NavHref } from "@/lib/config/nav";
import { cn } from "@/lib/utils";

type MobileNavItem =
  | { kind: "link"; href: NavHref; icon: typeof Home; label: string }
  | { kind: "locked"; id: "scout"; icon: typeof Home; label: string; description: string };

const MOBILE_NAV: MobileNavItem[] = [
  { kind: "link", href: "/home", icon: Home, label: "Home" },
  { kind: "link", href: "/applications", icon: LayoutGrid, label: "Apps" },
  { kind: "link", href: "/openings", icon: Radio, label: "Feed" },
  SCOUT_ENABLED
    ? { kind: "link", href: "/chat", icon: Dog, label: "Scout" }
    : {
        kind: "locked",
        id: "scout",
        icon: Dog,
        label: "Scout",
        description: SCOUT_LOCKED_COPY.description,
      },
];

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
              <div className="h-full min-h-0 pb-20 md:pb-0">{children}</div>
            </NavigationPendingGate>
          </ContentArea>
        </div>
        <MobileNav />
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

function MobileNav() {
  const { startNavigation } = useNavigationPending();
  const active = useDisplayNavHref();

  return (
    <nav
      aria-label="Mobile pages"
      className="fixed inset-x-3 bottom-3 z-50 rounded-lg border border-border bg-card p-1 shadow-sm md:hidden"
    >
      <div className="flex items-stretch justify-between gap-0.5">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          if (item.kind === "locked") {
            return (
              <button
                key={item.id}
                type="button"
                disabled
                aria-label={`${item.label}, coming soon`}
                title={item.description}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] font-medium",
                  "cursor-default text-muted-foreground/70",
                )}
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden />
                <span className="truncate">{item.label}</span>
                <Lock
                  size={10}
                  strokeWidth={1.9}
                  className="absolute right-2 top-1.5 text-muted-foreground/55"
                  aria-hidden
                />
              </button>
            );
          }

          const { href, label } = item;
          const isActive = active === href;
          return (
            <Link
              key={href}
              href={href}
              onPointerDown={() => startNavigation(href)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] font-medium",
                "transition-[background-color,color,transform] duration-200 ease-[var(--motion-ease-smooth)] active:scale-[0.97]",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        <MobileMoreNav />
      </div>
    </nav>
  );
}
