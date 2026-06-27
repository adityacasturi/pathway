"use client";

import { useState } from "react";
import { Bell, CircleHelp, Layers, SlidersHorizontal, Sparkles, ToggleRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToolbarButton } from "@/components/ui/toolbar-button";

function HelpItem({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: string;
}) {
  return (
    <li className="flex gap-3 py-4">
      <Icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

export function AlertsHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ToolbarButton
        aria-label="How alerts work"
        className="size-8 shrink-0 justify-center px-0"
        onClick={() => setOpen(true)}
      >
        <CircleHelp size={16} strokeWidth={1.75} className="text-muted-foreground" />
      </ToolbarButton>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader className="gap-2 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              How alerts work
            </DialogTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Email when internships you care about get posted.
            </p>
          </DialogHeader>

          <ul className="divide-y divide-border border-t border-border">
            <HelpItem icon={Sparkles} title="Pick what to watch">
              Add a company or an industry pack.
            </HelpItem>
            <HelpItem icon={Bell} title="Get an email">
              We send you a note when something new matches.
            </HelpItem>
            <HelpItem icon={SlidersHorizontal} title="Default filters">
              Season and location for most alerts. Set them once with Default filters.
            </HelpItem>
            <HelpItem icon={Layers} title="Custom filters">
              Click an alert to give just that one different rules.
            </HelpItem>
            <HelpItem icon={ToggleRight} title="On or off">
              Flip the switch to pause email. Your alert stays saved.
            </HelpItem>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
