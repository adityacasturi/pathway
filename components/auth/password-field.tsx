"use client";

import { Eye, EyeOff } from "lucide-react";
import { AUTH_ICON_BUTTON_CLASS, AUTH_PASSWORD_INPUT_CLASS } from "@/components/auth/auth-page";
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
        className={AUTH_PASSWORD_INPUT_CLASS}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        className={AUTH_ICON_BUTTON_CLASS}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
