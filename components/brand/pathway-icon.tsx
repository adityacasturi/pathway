import Image from "next/image";
import { cn } from "@/lib/utils";

const PATHWAY_ICON_SRC = "/brand/pathway-favicon-512.png";

export function PathwayIcon({ className }: { className?: string }) {
  return (
    <Image
      src={PATHWAY_ICON_SRC}
      alt=""
      width={32}
      height={32}
      className={cn("size-8 rounded-[0.45rem]", className)}
      aria-hidden
    />
  );
}
