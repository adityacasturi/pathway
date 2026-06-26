"use client";

import { useState } from "react";
import Link from "next/link";
import { PathwayIcon } from "@/components/brand/pathway-icon";
import { PathwayLogo } from "@/components/brand/pathway-logo";
import { MobileNavDrawer } from "@/components/app-shell/mobile-nav-drawer";
import { TopBarAccount } from "@/components/app-shell/top-bar-account";
import { useDisplayNavHref } from "@/components/app-shell/navigation-pending";
import { getPageLabel } from "@/lib/config/nav";

function MobileMenuButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-foreground md:hidden"
      aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={open}
      aria-controls="mobile-app-nav"
      onClick={onToggle}
    >
      <span className="flex h-4 w-6 flex-col justify-between" aria-hidden>
        <span className="h-[2px] w-full rounded-full bg-current" />
        <span className="h-[2px] w-full rounded-full bg-current" />
        <span className="h-[2px] w-full rounded-full bg-current" />
      </span>
    </button>
  );
}

export function AppTopBar({ userEmail }: { userEmail: string | null }) {
  const pageTitle = getPageLabel(useDisplayNavHref());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 flex h-[var(--app-topbar-height)] shrink-0 border-b border-border bg-[var(--shell-sidebar)]">
        <div className="hidden w-[var(--app-sidebar-width)] shrink-0 items-center border-r border-border bg-[var(--shell-sidebar)] px-5 md:flex">
          <Link
            href="/home"
            aria-label="Pathway home"
            className="inline-flex transition-opacity hover:opacity-90"
          >
            <PathwayLogo priority className="h-9" />
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-4 bg-background px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2 md:gap-3 md:text-[1.375rem]">
            <MobileMenuButton
              open={mobileNavOpen}
              onToggle={() => setMobileNavOpen((value) => !value)}
            />
            <h1 className="min-w-0 truncate text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground md:text-[1.375rem] md:leading-snug">
              {pageTitle}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/home"
              aria-label="Pathway home"
              className="inline-flex rounded-md transition-opacity hover:opacity-90 active:scale-[0.97] md:hidden"
            >
              <PathwayIcon />
            </Link>
            <div className="hidden md:block">
              <TopBarAccount userEmail={userEmail} />
            </div>
          </div>
        </div>
      </header>

      <MobileNavDrawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        userEmail={userEmail}
      />
    </>
  );
}
