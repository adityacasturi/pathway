import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata/page";

export const metadata = pageMetadata("Create account", "Create your Pathway account.");

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
