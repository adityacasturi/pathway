import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HomeHeaderArrowLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
    >
      <ArrowRight size={16} strokeWidth={1.75} />
    </Link>
  );
}
