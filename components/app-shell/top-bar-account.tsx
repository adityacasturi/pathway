"use client";

import { UserAvatar } from "@/components/ui/avatar";
import { getUserDisplayName, getUserInitials } from "@/lib/ui/user-initials";

export function TopBarAccount({
  userEmail,
}: {
  userEmail: string | null;
}) {
  const email = userEmail ?? "";
  const initials = getUserInitials(email);
  const displayName = getUserDisplayName(email);

  return (
    <div className="inline-flex shrink-0 items-center rounded-full p-0.5">
      <UserAvatar initials={initials} size="md" alt={displayName} />
    </div>
  );
}
