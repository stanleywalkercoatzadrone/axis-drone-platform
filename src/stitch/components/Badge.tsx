import React from 'react';
import { cn } from '../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        const variants = {
            default: 'border-transparent bg-blue-600 text-white hover:bg-blue-600/80',
            secondary: 'border-transparent bg-slate-800 text-slate-50 hover:bg-slate-800/80',
            outline: 'text-slate-50 border-slate-700',
            success: 'border-transparent bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/20',
            warning: 'border-transparent bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border-amber-500/20',
            destructive: 'border-transparent bg-red-900/30 text-red-400 hover:bg-red-900/50 border-red-500/20',
            info: 'border-transparent bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border-blue-500/20',
        };

        return (
            <div
                ref={ref}
                className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2',
                    variants[variant],
                    className
                )}
                {...props}
            />
        );
    }
);
Badge.displayName = 'Badge';
