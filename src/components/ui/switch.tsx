"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full bg-secondary p-0.5 transition-colors outline-none after:absolute after:-inset-x-2 after:-inset-y-1.5 focus-visible:ring-[3px] focus-visible:ring-ring/45 data-[size=default]:h-7 data-[size=default]:w-[46px] data-[size=sm]:h-5 data-[size=sm]:w-8 data-checked:bg-green data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-out group-data-[size=default]/switch:size-6 group-data-[size=sm]/switch:size-4 group-data-[size=default]/switch:data-checked:translate-x-[18px] group-data-[size=sm]/switch:data-checked:translate-x-3"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
