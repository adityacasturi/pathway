"use client";

export function IconButton({
  children,
  label,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-lg transition-colors duration-150 ${
        tone === "danger"
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function DeadlineActionButton({
  children,
  label,
  onClick,
  disabled,
  tone = "neutral",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex size-7 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-50 ${
        tone === "danger"
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-foreground/5"
      }`}
    >
      {children}
    </button>
  );
}
