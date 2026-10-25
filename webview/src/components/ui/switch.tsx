import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
        ref={ref}
        className={cn(
            'peer inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-input-border bg-muted outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:bg-primary',
            className,
        )}
        {...props}
    >
        <SwitchPrimitive.Thumb className="block size-2.5 translate-x-0.5 rounded-full bg-foreground/70 transition-transform data-[state=checked]:translate-x-[14px] data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';
