"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Copy, KeyRound, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { SettingsGroup } from "@/components/settings/settings-group";
import { UserAvatar } from "@/components/ui/avatar";
import { InlineError } from "@/components/ui/inline-error";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import { requestPasswordResetEmail } from "@/lib/actions/settings";
import { getUserInitials } from "@/lib/ui/user-initials";

interface Props {
  userEmail: string | null | undefined;
}

function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending} className="h-8 gap-1.5">
      {pending ? (
        <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
      ) : (
        <LogOut size={14} strokeWidth={1.75} />
      )}
      {pending ? "Signing out" : "Sign out"}
    </Button>
  );
}

function SettingsError({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  if (!message) return null;
  return (
    <div className="px-5 pb-4">
      <InlineError message={message} onRetry={onRetry} />
    </div>
  );
}

export function SettingsAccountPage({ userEmail }: Props) {
  const safeEmail = userEmail ?? "";
  const initials = getUserInitials(safeEmail);

  const [passwordResetPending, startPasswordResetTransition] = useTransition();
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null);

  async function onCopyEmail() {
    if (!safeEmail) return;
    try {
      await navigator.clipboard.writeText(safeEmail);
      toast.success("Email copied");
    } catch {
      toast.error("Couldn't copy email");
    }
  }

  function onPasswordReset() {
    setPasswordResetError(null);
    startPasswordResetTransition(async () => {
      const result = await requestPasswordResetEmail();
      if (result?.error) {
        setPasswordResetError(result.error);
        return;
      }
      toast.success("Password reset email sent", {
        description: `Check ${safeEmail} for a link to set a new password.`,
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsGroup title="Profile" description="Your signed-in account.">
        <div className="flex items-center gap-4 px-5 py-4">
          <UserAvatar initials={initials} size="md" alt={safeEmail} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">
              {safeEmail || "—"}
            </p>
          </div>
          {safeEmail ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              onClick={() => void onCopyEmail()}
            >
              <Copy size={14} strokeWidth={1.75} aria-hidden />
              Copy
            </Button>
          ) : null}
          <form action={logout}>
            <SignOutButton />
          </form>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Password" description="Update your sign-in credentials.">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Send a reset link to your email to choose a new password.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5"
            disabled={passwordResetPending || !safeEmail}
            onClick={onPasswordReset}
          >
            {passwordResetPending ? (
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            ) : (
              <KeyRound size={14} strokeWidth={1.75} />
            )}
            {passwordResetPending ? "Sending" : "Send reset email"}
          </Button>
        </div>
        <SettingsError message={passwordResetError} onRetry={() => setPasswordResetError(null)} />
      </SettingsGroup>
    </div>
  );
}
