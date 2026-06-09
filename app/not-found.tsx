import Link from "next/link";
import { cookies } from "next/headers";

async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return cookieStore
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  } catch {
    return false;
  }
}

export default async function NotFound() {
  const signedIn = await isAuthenticated();
  const homeHref = signedIn ? "/home" : "/";
  const homeLabel = signedIn ? "Back to Home" : "Back to landing";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pathway</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found.</h1>
        <p className="text-sm text-muted-foreground">
          This view is not available anymore. Head back to {signedIn ? "your dashboard" : "the landing page"}.
        </p>
        <Link
          href={homeHref}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-rule-strong bg-card px-3 text-xs font-medium uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
