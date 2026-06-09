"use client";

import { UserAvatar } from "@/components/ui/avatar";
import { getUserDisplayName, getUserInitials } from "@/lib/ui/user-initials";

export function SidebarAccount({ userEmail }: { userEmail: string | null }) {
  const email = userEmail ?? "";
  const initials = getUserInitials(email);
  const displayName = getUserDisplayName(email);

  return (
    <div className="relative z-10 shrink-0 border-t border-border p-4">
      <div className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2">
        <UserAvatar initials={initials} size="md" alt={displayName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-snug text-foreground">
            {displayName}
          </span>
          {email ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{email}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
