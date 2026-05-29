"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motionVariants } from "@/lib/ui/motion";

export const AUTH_INPUT_CLASS =
  "h-11 rounded-lg bg-card px-3 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30";

export const AUTH_PASSWORD_INPUT_CLASS =
  "h-11 rounded-lg bg-card px-3 pr-11 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30";

export const AUTH_ICON_BUTTON_CLASS =
  "absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-45";

export const AUTH_PRIMARY_BUTTON_CLASS = "primary-surface h-11 w-full rounded-lg text-[14px]";

export const AUTH_FOOTER_CLASS = "mt-7 text-center text-[13px] leading-relaxed text-muted-foreground";

export const AUTH_LINK_CLASS = "font-medium text-foreground transition-colors duration-150 hover:text-primary";

const AUTH_HELP_TEXT_CLASS = "text-[12px] leading-relaxed";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12 sm:px-8">
        <motion.div
          className="w-full"
          variants={motionVariants.riseIn}
          initial={false}
          animate="visible"
        >
          {children}
        </motion.div>
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
    <div className="mb-10">
      <Link href="/" aria-label="Pathway home" className="inline-flex items-center">
        <Image
          src="/brand/pathway-logo-black-transparent-600w.png"
          alt="Pathway"
          width={600}
          height={148}
          priority
          className="brand-wordmark h-[36px] w-auto sm:h-[40px]"
        />
      </Link>
      <h1 className="display-serif mt-5 text-[2.25rem] text-foreground">{title}</h1>
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
        tone === "success" && "text-[color-mix(in_oklab,#2f7d5b_88%,var(--foreground))]",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}
