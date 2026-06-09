"use client";

import { Avatar as HeroAvatar } from "@heroui/react";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  initials: string;
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function UserAvatar({ initials, src, alt, size = "md", className }: UserAvatarProps) {
  return (
    <HeroAvatar size={size} className={cn("shrink-0", className)}>
      {src ? <HeroAvatar.Image src={src} alt={alt ?? initials} /> : null}
      <HeroAvatar.Fallback className="text-xs font-semibold tracking-wide">
        {initials}
      </HeroAvatar.Fallback>
    </HeroAvatar>
  );
}
