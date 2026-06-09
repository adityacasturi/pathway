import Image from "next/image";
import type { ReactNode } from "react";
import { CHAT_ASSISTANT_NAME } from "@/lib/chat/assistant";
import { cn } from "@/lib/utils";

export function chatPanelClassName(className?: string) {
  return cn(
    "relative overflow-hidden rounded-[1.25rem]",
    "border border-[color-mix(in_oklab,var(--primary)_16%,var(--border))]",
    "bg-gradient-to-b from-[color-mix(in_oklab,var(--primary)_5%,var(--card))] to-card",
    "shadow-[0_1px_0_color-mix(in_oklab,white_60%,transparent)_inset,0_2px_12px_-4px_color-mix(in_oklab,var(--ink)_10%,transparent),0_28px_72px_-36px_color-mix(in_oklab,var(--primary)_28%,transparent)]",
    className,
  );
}

export function chatPanelFocusClassName(className?: string) {
  return cn(
    "transition-[border-color,box-shadow] duration-200",
    "focus-within:border-[color-mix(in_oklab,var(--primary)_32%,var(--border))]",
    "focus-within:shadow-[0_1px_0_color-mix(in_oklab,white_60%,transparent)_inset,0_0_0_3px_color-mix(in_oklab,var(--primary)_10%,transparent),0_28px_72px_-32px_color-mix(in_oklab,var(--primary)_34%,transparent)]",
    className,
  );
}

export function chatInsetCardClassName(className?: string) {
  return cn(
    "relative overflow-hidden rounded-xl",
    "border border-[color-mix(in_oklab,var(--primary)_12%,var(--border))]",
    "bg-gradient-to-b from-[color-mix(in_oklab,var(--primary)_4%,var(--card))] to-card",
    "shadow-[0_1px_0_color-mix(in_oklab,white_50%,transparent)_inset,0_8px_24px_-16px_color-mix(in_oklab,var(--primary)_20%,transparent)]",
    className,
  );
}

export function chatUserBubbleClassName(className?: string) {
  return cn(
    "max-w-[85%] rounded-[1.15rem] rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-foreground",
    "border border-[color-mix(in_oklab,var(--primary)_22%,var(--border))]",
    "bg-gradient-to-br from-[color-mix(in_oklab,var(--primary)_10%,var(--card))] to-[color-mix(in_oklab,var(--primary)_4%,var(--card))]",
    "shadow-[0_1px_0_color-mix(in_oklab,white_55%,transparent)_inset,0_10px_28px_-18px_color-mix(in_oklab,var(--primary)_30%,transparent)]",
    className,
  );
}

function ChatPanelHighlight() {
  return (
    <div
      className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_40%,transparent),transparent)]"
      aria-hidden
    />
  );
}

export function ChatPanel({
  children,
  className,
  focusable = false,
}: {
  children: ReactNode;
  className?: string;
  focusable?: boolean;
}) {
  return (
    <div className={cn(chatPanelClassName(), focusable && chatPanelFocusClassName(), className)}>
      <ChatPanelHighlight />
      {children}
    </div>
  );
}

export function ChatInsetCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(chatInsetCardClassName(), className)}>
      <div
        className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_30%,transparent),transparent)]"
        aria-hidden
      />
      {children}
    </div>
  );
}

export function ChatDataCard({
  title,
  description,
  actions,
  children,
  className,
  padding = "p-4",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  const flush = padding === "p-0";

  return (
    <ChatPanel className={cn(flush ? "p-0" : padding, className)}>
      {(title || description || actions) && (
        <div
          className={cn(
            "flex items-start justify-between gap-3 border-b border-[color-mix(in_oklab,var(--primary)_10%,var(--border))]",
            flush ? "px-4 py-3" : "mb-3 pb-3",
          )}
        >
          <div className="min-w-0">
            {title ? <h3 className="text-sm font-medium text-foreground">{title}</h3> : null}
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      {children}
    </ChatPanel>
  );
}

export function chatHeaderClassName(className?: string) {
  return cn(
    "relative flex shrink-0 items-center border-b border-[color-mix(in_oklab,var(--primary)_10%,var(--border))]",
    "h-16 bg-gradient-to-b from-[color-mix(in_oklab,var(--primary)_4%,var(--card))] to-card",
    className,
  );
}

export function chatHeaderHighlightClassName() {
  return "pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_18%,transparent),transparent)]";
}

const SCOUT_AVATAR_SRC = "/brand/scout-avatar.png";

const SCOUT_AVATAR_SIZES = {
  sm: { px: 28, className: "size-7" },
  default: { px: 36, className: "size-9" },
  lg: { px: 56, className: "size-14" },
  xl: { px: 80, className: "size-20" },
} as const;

export function ScoutAvatar({
  loading = false,
  size = "default",
  className,
}: {
  loading?: boolean;
  size?: keyof typeof SCOUT_AVATAR_SIZES;
  className?: string;
}) {
  const { px, className: sizeClassName } = SCOUT_AVATAR_SIZES[size];
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full",
        "border border-[color-mix(in_oklab,var(--primary)_18%,var(--border))]",
        "bg-card shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--primary)_35%,transparent)]",
        sizeClassName,
        loading && "animate-pulse",
        className,
      )}
      aria-hidden={size !== "xl"}
      role={size === "xl" ? "img" : undefined}
      aria-label={size === "xl" ? CHAT_ASSISTANT_NAME : undefined}
    >
      <Image
        src={SCOUT_AVATAR_SRC}
        alt={size === "xl" ? CHAT_ASSISTANT_NAME : ""}
        width={px}
        height={px}
        className="size-full object-cover"
        priority={size === "xl"}
      />
    </div>
  );
}
