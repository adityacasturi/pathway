import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function MetadataRow({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon
        className="size-3.5 shrink-0 text-muted-foreground/50"
        strokeWidth={1.75}
        aria-hidden
      />
      <div className="min-w-0 flex-1 text-[13px] leading-normal">{children}</div>
    </div>
  );
}
