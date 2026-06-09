"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PathwayLogo } from "@/components/brand/pathway-logo";
import { Surface } from "@/components/design-system/surface";
import { cn } from "@/lib/utils";

export const AUTH_INPUT_CLASS =
  "h-10 rounded-md bg-card px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:border-ring";

export const AUTH_PASSWORD_INPUT_CLASS =
  "h-10 rounded-md bg-card px-3 pr-10 text-sm placeholder:text-muted-foreground/50 focus-visible:border-ring";

export const AUTH_ICON_BUTTON_CLASS =
  "absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-45";

export const AUTH_PRIMARY_BUTTON_CLASS = "h-10 w-full rounded-md text-sm";

export const AUTH_FOOTER_CLASS = "mt-6 text-center text-xs leading-relaxed text-muted-foreground";

export const AUTH_LINK_CLASS = "font-medium text-foreground transition-colors hover:text-primary";

const AUTH_HELP_TEXT_CLASS = "text-xs leading-relaxed";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10 sm:max-w-lg">
        <Surface padding="p-6 sm:p-7" className="w-full rounded-2xl">
          {children}
        </Surface>
      </main>
    </div>
  );
}

export function AuthPageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <Link href="/" aria-label="Pathway home" className="inline-flex items-center">
        <PathwayLogo priority className="h-7 w-auto" />
      </Link>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      {children}
    </div>
  );
}

export function AuthHelpText({
  id,
  tone = "muted",
  children,
}: {
  id?: string;
  tone?: "muted" | "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      className={cn(
        AUTH_HELP_TEXT_CLASS,
        tone === "error" && "text-destructive",
        tone === "success" && "text-primary",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}
