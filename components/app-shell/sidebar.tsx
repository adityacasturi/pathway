"use client";

import { SidebarNavContent } from "@/components/app-shell/sidebar-nav-content";

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  return (
    <aside
      className="app-sidebar fixed inset-y-0 left-0 z-[45] hidden w-[var(--app-sidebar-width)] flex-col border-r border-border bg-[var(--shell-sidebar)] pt-[var(--app-topbar-height)] font-sans antialiased md:flex"
      aria-label="Application"
    >
      <SidebarNavContent userEmail={userEmail} />
    </aside>
  );
}
