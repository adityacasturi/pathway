import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToolbarPillProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  active?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  as?: "button" | "span";
};

export function ToolbarPill({
  active = false,
  icon,
  badge,
  as = "button",
  className,
  children,
  ...props
}: ToolbarPillProps) {
  const classes = cn("toolbar-pill", active && "toolbar-pill--active", className);

  if (as === "span") {
    return (
      <span className={classes}>
        {icon ? (
          <span className="toolbar-pill__icon" aria-hidden>
            {icon}
          </span>
        ) : null}
        {children}
        {badge}
      </span>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {icon ? (
        <span className="toolbar-pill__icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      {children}
      {badge}
    </button>
  );
}
