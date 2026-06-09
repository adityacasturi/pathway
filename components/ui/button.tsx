"use client"

import * as React from "react"
import { Button as HeroButton } from "@heroui/react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button box-border shrink-0 gap-1.5 rounded-lg border bg-clip-padding font-medium leading-[1.2] tracking-normal whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-[var(--motion-ease-smooth)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:brightness-105",
        outline:
          "border-border bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] text-foreground hover:bg-[color-mix(in_oklab,var(--foreground)_7%,transparent)] aria-expanded:bg-[color-mix(in_oklab,var(--foreground)_7%,transparent)]",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "border-transparent bg-transparent px-0 shadow-none text-[var(--link)] underline-offset-4 hover:text-[var(--link-hover)] hover:underline",
      },
      size: {
        default:
          "h-8 min-h-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-h-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
  )

function Button({
  className,
  variant = "default",
  size = "default",
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof HeroButton>, "variant" | "size" | "isDisabled"> &
  React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { disabled?: boolean }) {
  const heroVariant =
    variant === "default"
      ? "primary"
      : variant === "destructive"
        ? "danger-soft"
        : variant === "outline"
          ? "outline"
          : variant === "secondary"
            ? "secondary"
            : "ghost";
  const heroSize = size === "lg" || size === "icon-lg" ? "lg" : size === "sm" || size === "xs" || size === "icon-sm" || size === "icon-xs" ? "sm" : "md";
  const isIconOnly = typeof size === "string" && size.startsWith("icon");

  return (
    <HeroButton
      data-slot="button"
      variant={heroVariant}
      size={heroSize}
      isIconOnly={isIconOnly}
      isDisabled={disabled}
      className={cn(buttonVariants({ variant, size, className }))}
      {...(props as React.ComponentProps<typeof HeroButton>)}
    />
  )
}

export { Button, buttonVariants }
