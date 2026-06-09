import type { ComponentType } from "react";
import { Palette, User } from "lucide-react";

export type SettingsHref = "/settings/account" | "/settings/appearance";

export type SettingsNavItem = {
  href: SettingsHref;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    href: "/settings/account",
    label: "Account",
    description: "Profile and sign-in",
    icon: User,
  },
  {
    href: "/settings/appearance",
    label: "Appearance",
    description: "Theme and accent color",
    icon: Palette,
  },
] as const;

export const DEFAULT_SETTINGS_HREF: SettingsHref = "/settings/account";

export function getActiveSettingsHref(pathname: string): SettingsHref {
  const match = SETTINGS_NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  return match?.href ?? DEFAULT_SETTINGS_HREF;
}

export function isActiveSettingsHref(pathname: string, href: SettingsHref) {
  return getActiveSettingsHref(pathname) === href;
}
