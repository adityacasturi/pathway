import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HomeSectionHeader({
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
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-none tracking-tight text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
    </div>
  );
}
