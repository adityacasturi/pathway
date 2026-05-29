import { cn } from "@/lib/utils";

export function Switch({
  checked,
  disabled,
  onCheckedChange,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-busy={disabled}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-11 min-w-11 shrink-0 rounded-full border",
        "transition-[transform,box-shadow] duration-150",
        "disabled:pointer-events-none disabled:opacity-50",
        checked
          ? "border-[color:var(--primary)] bg-[color:var(--primary)]"
          : "border-[color:var(--rule-strong)] bg-[color-mix(in_oklab,var(--ink)_12%,var(--card))]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-0.5 size-5 -translate-y-1/2 rounded-full bg-white shadow-sm",
          "transition-transform duration-150 ease-out",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
