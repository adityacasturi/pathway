"use client";

import Link from "next/link";
import { PathwayLogo } from "@/components/brand/pathway-logo";
import { TopBarAccount } from "@/components/app-shell/top-bar-account";
import { useDisplayNavHref } from "@/components/app-shell/navigation-pending";
import { getPageLabel } from "@/lib/config/nav";

export function AppTopBar({ userEmail }: { userEmail: string | null }) {
  const pageTitle = getPageLabel(useDisplayNavHref());

  return (
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

      <div className="flex min-w-0 flex-1 items-center justify-between gap-4 bg-background px-5 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/home"
            aria-label="Pathway home"
            className="inline-flex shrink-0 transition-opacity hover:opacity-90 md:hidden"
          >
            <PathwayLogo className="h-8" />
          </Link>
          <h1 className="min-w-0 text-xl font-semibold leading-snug tracking-tight text-foreground md:text-[1.375rem]">
            {pageTitle}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TopBarAccount userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
}
