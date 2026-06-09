"use client"

import * as React from "react"
import { Input as HeroInput } from "@heroui/react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <HeroInput
      type={type}
      data-slot="input"
      variant="primary"
      fullWidth
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-border bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-3 py-1.5 text-base text-foreground outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--primary)_25%,transparent)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
