"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MaintenanceRefreshButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 shrink-0 gap-2"
      onClick={() => window.location.reload()}
    >
      <RefreshCw size={14} strokeWidth={1.75} aria-hidden />
      Check again
    </Button>
  );
}
