import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "inline-flex h-5 w-9 items-center rounded-full bg-muted data-[state=checked]:bg-primary",
      className
    )}
    ref={ref}
    {...props}
  >
    <SwitchPrimitives.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-4" />
  </SwitchPrimitives.Root>
));
Switch.displayName = "Switch";
