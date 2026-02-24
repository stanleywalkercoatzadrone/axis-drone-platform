import React from 'react';
import { cn } from '../utils/cn';

export const Heading = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement> & { level?: 1 | 2 | 3 | 4 | 5 | 6 }>(
    ({ className, level = 1, ...props }, ref) => {
        const Component = `h${level}` as any;
        const sizes = {
            1: 'text-4xl font-bold tracking-tight',
            2: 'text-3xl font-semibold tracking-tight',
            3: 'text-2xl font-semibold tracking-tight',
            4: 'text-xl font-semibold tracking-tight',
            5: 'text-lg font-semibold',
            6: 'text-base font-semibold',
        };
        return (
            <Component
                ref={ref}
                className={cn('text-slate-50', sizes[level], className)}
                {...props}
            />
        );
    }
);
Heading.displayName = 'Heading';

export const Text = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement> & { variant?: 'default' | 'muted' | 'small' }>(
    ({ className, variant = 'default', ...props }, ref) => {
        const variants = {
            default: 'leading-7 text-slate-300',
            muted: 'text-sm text-slate-400',
            small: 'text-xs font-medium leading-none text-slate-500',
        };
        return (
            <p
                ref={ref}
                className={cn(variants[variant], className)}
                {...props}
            />
        );
    }
);
Text.displayName = 'Text';
