import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-lg space-y-4">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Pathway</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found.</h1>
        <p className="text-sm text-muted-foreground">
          This view is not available anymore. Head back to your application dashboard.
        </p>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "inline-flex text-xs uppercase tracking-wider",
          )}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
