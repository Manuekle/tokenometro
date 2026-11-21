import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-full bg-input px-4 text-sm shadow-raise outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:ring-[3px] focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px] aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
