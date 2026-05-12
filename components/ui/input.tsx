import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input/80 bg-card/80 px-2.5 py-1 text-base shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] outline-none transition-[border-color,background-color,box-shadow,opacity] duration-200 ease-[var(--motion-ease-smooth)] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-ring)_18%,transparent),inset_0_1px_0_rgb(255_255_255/0.08)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
