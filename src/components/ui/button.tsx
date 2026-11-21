import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold tracking-[0.005em] whitespace-nowrap transition-[background-color,box-shadow,transform,opacity] duration-150 outline-none select-none [font-variation-settings:'ROND'_80] focus-visible:ring-[3px] focus-visible:ring-ring/45 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_.sym]:text-[1.05em]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        outline:
          "bg-raise text-foreground shadow-raise hover:bg-raise/60 dark:hover:bg-accent aria-expanded:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/15",
        link: "rounded-none text-foreground underline underline-offset-4 hover:no-underline",
      },
      size: {
        default: "h-10 px-5 text-sm",
        xs: "h-7 px-3 text-xs",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-12 px-7 text-[15px]",
        icon: "size-10",
        "icon-xs": "size-7 text-xs",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
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
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
