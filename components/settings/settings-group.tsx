import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
