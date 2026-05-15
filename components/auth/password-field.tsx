"use client";

import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PasswordField({
  id,
  name,
  value,
  visible,
  disabled,
  autoComplete,
  ariaDescribedBy,
  ariaInvalid,
  minLength,
  pattern,
  title,
  onChange,
  onToggleVisible,
}: {
  id: string;
  name: string;
  value: string;
  visible: boolean;
  disabled: boolean;
  autoComplete: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  minLength?: number;
  pattern?: string;
  title?: string;
  onChange: (value: string) => void;
  onToggleVisible: () => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        pattern={pattern}
        title={title}
        autoComplete={autoComplete}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        placeholder="Password"
        className="h-11 rounded-lg bg-card px-3 pr-11 text-[15px] placeholder:text-muted-foreground/40 focus-visible:border-foreground/30"
      />
      <button
        type="button"
        onClick={onToggleVisible}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
