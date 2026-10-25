import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-[13px] font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_.codicon]:text-[15px]",
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
                outline: 'border border-border bg-transparent hover:bg-accent',
                ghost: 'hover:bg-accent',
                destructive: 'text-destructive hover:bg-destructive/15',
            },
            size: {
                default: 'h-7 px-3',
                sm: 'h-6 px-2 text-[12px]',
                icon: 'size-7',
                'icon-sm': 'size-6',
            },
        },
        defaultVariants: { variant: 'default', size: 'default' },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return <Comp ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
    },
);
Button.displayName = 'Button';
