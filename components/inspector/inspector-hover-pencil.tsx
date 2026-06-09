import { Pencil } from "lucide-react";
import { INSPECTOR_HOVER_PENCIL_CLASS } from "@/components/inspector/inspector-field-styles";
import { cn } from "@/lib/utils";

export function InspectorHoverPencil({ className }: { className?: string }) {
  return (
    <span className={cn(INSPECTOR_HOVER_PENCIL_CLASS, className)} aria-hidden>
      <Pencil size={13} strokeWidth={1.75} />
    </span>
  );
}
