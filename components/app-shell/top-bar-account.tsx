"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, LogOut } from "lucide-react";
import { Surface } from "@/components/design-system/surface";
import { UserAvatar } from "@/components/ui/avatar";
import { logout } from "@/lib/actions/auth";
import { getUserDisplayName, getUserInitials } from "@/lib/ui/user-initials";
import { cn } from "@/lib/utils";

function SignOutMenuItem() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      role="menuitem"
      disabled={pending}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm text-foreground transition-colors",
        "hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-60",
      )}
    >
      {pending ? (
        <Loader2 size={15} strokeWidth={1.75} className="animate-spin" aria-hidden />
      ) : (
        <LogOut size={15} strokeWidth={1.75} aria-hidden />
      )}
      {pending ? "Signing out" : "Sign out"}
    </button>
  );
}

export function TopBarAccount({
  userEmail,
}: {
  userEmail: string | null;
}) {
  const email = userEmail ?? "";
  const initials = getUserInitials(email);
  const displayName = getUserDisplayName(email);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (!open) return;
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted/60",
        )}
      >
        <UserAvatar initials={initials} size="md" alt={displayName} />
      </button>

      {open ? (
        <Surface
          padding="p-1.5"
          className="absolute right-0 top-full z-50 mt-1.5 w-44 shadow-sm"
        >
          <ul role="menu" aria-label="Account" className="space-y-0.5">
            <li role="none">
              <form action={logout}>
                <SignOutMenuItem />
              </form>
            </li>
          </ul>
        </Surface>
      ) : null}
    </div>
  );
}
