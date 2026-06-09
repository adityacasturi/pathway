import { cn } from "@/lib/utils";

/** flag-icons sprites; explicit 3:2 width keeps flags rectangular in tight chip rows. */
const FLAG_SIZES = {
  sm: { width: 16, height: 11 },
  md: { width: 21, height: 14 },
  lg: { width: 26, height: 17 },
} as const;

export function CountryFlag({
  code,
  size = "md",
  className,
}: {
  code: string;
  size?: keyof typeof FLAG_SIZES;
  className?: string;
}) {
  const normalized = code.trim().toLowerCase();
  const dimensions = FLAG_SIZES[size];

  return (
    <span
      className={cn(
        "fi",
        `fi-${normalized}`,
        "inline-block shrink-0 overflow-hidden rounded-[2px] bg-cover bg-center",
        className,
      )}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
      aria-hidden
    />
  );
}
