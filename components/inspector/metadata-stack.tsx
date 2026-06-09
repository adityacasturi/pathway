import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetadataStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mt-2.5 space-y-1.5", className)}>{children}</div>;
}
