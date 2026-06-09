import { cn } from "@/lib/utils";

/** Frame for raster company logos. */
export function companyLogoImageClass(className?: string) {
  return cn(
    "company-logo-img block size-full rounded-[4px] object-contain object-center ring-1",
    "bg-background ring-border/30",
    className,
  );
}
