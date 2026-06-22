import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  primaryAction?: { label: string; onClick?: () => void; href?: string; icon?: ReactNode };
  secondaryAction?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex size-9 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? (
            primaryAction.href ? (
              <Link
                href={primaryAction.href}
                className={buttonVariants({
                  size: "sm",
                  className: "inline-flex h-9 items-center justify-center",
                })}
              >
                {primaryAction.icon}
                {primaryAction.label}
              </Link>
            ) : (
              <Button type="button" size="sm" className="h-9" onClick={primaryAction.onClick}>
                {primaryAction.icon}
                {primaryAction.label}
              </Button>
            )
          ) : null}
          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "inline-flex h-9 items-center justify-center",
              })}
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-10 text-sm text-muted-foreground",
        className,
      )}
      role="status"
    >
      <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-5",
        className,
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" className="mt-3 h-8" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
