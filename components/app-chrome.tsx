"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell/shell";

const HIDDEN_PATHS = new Set(["/", "/login", "/register", "/set-password"]);

export function AppChrome({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string | null;
}) {
  const pathname = usePathname();
  if (HIDDEN_PATHS.has(pathname)) return <>{children}</>;
  return <AppShell userEmail={userEmail}>{children}</AppShell>;
}
