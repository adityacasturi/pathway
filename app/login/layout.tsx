import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata/page";

export const metadata = pageMetadata("Sign in", "Sign in to your Pathway account.");

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
