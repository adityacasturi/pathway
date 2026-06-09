"use client";

import Image from "next/image";
import { PATHWAY_LOGO_SRC, pathwayLogoImageClass } from "@/lib/brand/pathway-logo";

export function PathwayLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={PATHWAY_LOGO_SRC}
      alt="Pathway"
      width={600}
      height={148}
      priority={priority}
      sizes="(max-width: 768px) 120px, 148px"
      className={pathwayLogoImageClass(className ?? "h-8")}
    />
  );
}
