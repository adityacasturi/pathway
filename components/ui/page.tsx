import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

type PageMainProps = {
  children: ReactNode;
  className?: string;
  width?: "md" | "lg" | "xl";
};

type PageHeaderProps = {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type PageSectionProps = {
  label?: string;
  title?: string;
  description?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  rule?: boolean;
};

const pageWidths = {
  md: "max-w-3xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("page-shell min-h-screen bg-background", className)}>
      {children}
    </div>
  );
}

export function PageMain({ children, className, width = "lg" }: PageMainProps) {
  return (
    <main
      className={cn(
        "mx-auto px-6 pb-24 pt-20 sm:px-10 sm:pt-21 lg:px-16 lg:pt-26",
        pageWidths[width],
        className,
      )}
    >
      {children}
    </main>
  );
}

export function PageHeader({ title, actions, children, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="display-serif text-[2.75rem] text-foreground sm:text-[3.25rem]">
          {title}
        </h1>
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageSection({
  label,
  title,
  description,
  meta,
  children,
  className,
  contentClassName,
  rule = true,
}: PageSectionProps) {
  const hasHeader = Boolean(label || title || description || meta);

  return (
    <section className={cn("mb-14", className)}>
      {hasHeader && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {label && <span className="label-micro">{label}</span>}
            {title && (
              <h2 className={cn("display-serif text-[24px] text-foreground", label && "mt-3")}>
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {meta && <div className="label-meta shrink-0">{meta}</div>}
        </div>
      )}
      {rule && <span className="rule mb-0" />}
      <div className={cn(rule ? "py-5" : undefined, contentClassName)}>{children}</div>
      {rule && <span className="rule mt-0" />}
    </section>
  );
}
