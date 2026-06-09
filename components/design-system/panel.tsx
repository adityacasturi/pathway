import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelVariant = "inset" | "flush";

/** Section container — inset has a hairline frame; flush is padding-only inside a PageFrame. */
export function Panel({
  children,
  className,
  padding = "p-5",
  variant = "inset",
  style,
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
  variant?: PanelVariant;
  style?: CSSProperties;
}) {
  if (variant === "flush") {
    return (
      <div className={cn(padding, className)} style={style}>
        {children}
      </div>
    );
  }
  return (
    <div className={cn("ds-surface", padding, className)} style={style}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
