import type { ReactNode } from "react";

export function FilterSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <section
      className="px-4 py-4 [&+section]:border-t"
      style={{ borderColor: "var(--rule)" }}
    >
      <header className="mb-4 flex items-center justify-between">
        <h3 className="font-mono text-[11px] font-medium text-foreground">{title}</h3>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {action.label}
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex w-full items-center gap-0.5 rounded-lg border p-0.5"
      style={{ borderColor: "var(--rule)" }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={
              "flex-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 " +
              (active
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center justify-between gap-4 rounded-sm px-1 py-1.5 text-[12px] text-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3 cursor-pointer rounded-[2px] accent-foreground"
      />
    </label>
  );
}
