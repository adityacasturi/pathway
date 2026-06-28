"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell/shell";

const HIDDEN_PATHS = new Set(["/", "/login", "/register", "/set-password", "/maintenance"]);

export function AppChrome({
  children,
  userEmail,
  maintenance = false,
}: {
  children: ReactNode;
  userEmail: string | null;
  maintenance?: boolean;
}) {
  const pathname = usePathname();
  if (maintenance || HIDDEN_PATHS.has(pathname)) return <>{children}</>;
  return <AppShell userEmail={userEmail}>{children}</AppShell>;
}
