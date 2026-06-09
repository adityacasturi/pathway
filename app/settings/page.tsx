import { redirect } from "next/navigation";
import { DEFAULT_SETTINGS_HREF } from "@/lib/config/settings-nav";

export default function SettingsIndexPage() {
  redirect(DEFAULT_SETTINGS_HREF);
}
