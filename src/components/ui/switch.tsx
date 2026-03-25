import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "@/lib/utils";

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "relative inline-flex h-[31px] w-[51px] shrink-0 cursor-default items-center rounded-full border-2 border-transparent",
      "bg-ios-gray-4 transition-colors",
      "data-[state=checked]:bg-ios-purple",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ios-purple focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-[27px] w-[27px] rounded-full bg-white shadow-md ring-0",
        "transition-transform data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[20px]",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;
