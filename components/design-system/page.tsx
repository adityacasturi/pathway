import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared content width for app pages. */
export const pageContentWidthClass = "w-full max-w-[72rem]";

export const pageWidths = {
  md: "max-w-3xl",
  lg: pageContentWidthClass,
  xl: pageContentWidthClass,
} as const;

/** App page gutters — px-6 py-5 */
export const pageMainPadding = "px-6 py-5";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

type PageMainProps = {
  children: ReactNode;
  className?: string;
  width?: keyof typeof pageWidths;
};

export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn("min-h-full", className)}>{children}</div>;
}

export function PageMain({ children, className, width = "lg" }: PageMainProps) {
  return (
    <main className={cn("mx-auto w-full pb-6", pageMainPadding, pageWidths[width], className)}>
      {children}
    </main>
  );
}

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cn("text-xl font-semibold tracking-tight text-foreground", className)}>
      {children}
    </h1>
  );
}

export function PageDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** Toolbar-aligned action cluster for page headers. */
export function PageActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-2", className)}>{children}</div>
  );
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {title ? <PageTitle>{title}</PageTitle> : null}
        {description ? <PageDescription>{description}</PageDescription> : null}
        {children}
        {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
      </div>
      {actions ? <PageActions>{actions}</PageActions> : null}
    </header>
  );
}

/** Section block with optional heading — gap-4 rhythm */
export function Section({
  label,
  title,
  description,
  meta,
  children,
  className,
  contentClassName,
  rule = false,
}: {
  label?: string;
  title?: string;
  description?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  rule?: boolean;
}) {
  const hasHeader = Boolean(label || title || description || meta);

  return (
    <section className={cn("mb-6", className)}>
      {hasHeader ? (
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {label ? (
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {label}
              </span>
            ) : null}
            {title ? (
              <h2
                className={cn(
                  "text-sm font-medium text-foreground",
                  label && "mt-0.5",
                )}
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {meta ? <div className="shrink-0 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
      ) : null}
      {rule ? <div className="mb-3 h-px bg-border" /> : null}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

