"use client";

import { Lock } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { ComingSoonHoverCard } from "@/components/design-system/coming-soon-hover-card";
import { NavLink } from "@/components/nav-link";
import { UI_SELECTED } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

const itemClass = (active: boolean) =>
  cn(
    "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm leading-snug tracking-normal",
    "transition-[background-color,color,box-shadow,transform] duration-200 ease-[var(--motion-ease-smooth)]",
    "active:scale-[0.98]",
    active
      ? cn(UI_SELECTED, "border border-transparent font-semibold")
      : "font-medium text-foreground/95 hover:bg-muted/55 hover:text-foreground",
  );

export function SidebarLockedItem({
  label,
  hint,
  description,
  icon: Icon,
}: {
  label: string;
  hint: string;
  description: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}) {
  return (
    <ComingSoonHoverCard
      title={label}
      hint={hint}
      description={description}
      icon={Icon}
      side="right"
    >
      <div
        tabIndex={0}
        aria-disabled="true"
        aria-label={`${label}, coming soon`}
        className={cn(
          itemClass(false),
          "cursor-default select-none text-foreground/62 hover:text-foreground/78",
        )}
      >
        <Icon size={17} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <Lock size={13} strokeWidth={1.75} className="shrink-0 text-muted-foreground/55" aria-hidden />
      </div>
    </ComingSoonHoverCard>
  );
}

export function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
  onPointerEnter,
  onFocus,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  active: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onPointerEnter?: () => void;
  onFocus?: () => void;
}) {
  return (
    <NavLink
      href={href}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      ariaLabel={label}
      className={itemClass(active)}
    >
      <Icon
        size={17}
        strokeWidth={1.75}
        className={cn("shrink-0", active ? "text-[var(--selection-fg)]" : "text-muted-foreground")}
      />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function SidebarSectionLabel({
  children,
  first = false,
}: {
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <p
      className={cn(
        "mb-1.5 px-3 text-xs font-semibold tracking-normal text-muted-foreground",
        first ? "mt-0" : "mt-5",
      )}
    >
      {children}
    </p>
  );
}

export function SidebarActionButton({
  children,
  onClick,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted/50",
        className,
      )}
    >
      {children}
    </button>
  );
}
