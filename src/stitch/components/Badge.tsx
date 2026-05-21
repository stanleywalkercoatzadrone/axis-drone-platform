import React from 'react';
import { cn } from '../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        const variants = {
            default: 'border border-blue-500/30 bg-blue-500/10 text-blue-400 backdrop-blur-md hover:bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
            secondary: 'border border-white/10 bg-white/5 text-slate-200 backdrop-blur-md hover:bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)]',
            outline: 'text-slate-300 border-white/10 backdrop-blur-sm',
            success: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 backdrop-blur-md hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
            warning: 'border border-amber-500/30 bg-amber-500/10 text-amber-400 backdrop-blur-md hover:bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
            destructive: 'border border-red-500/30 bg-red-500/10 text-red-400 backdrop-blur-md hover:bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
            info: 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 backdrop-blur-md hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]',
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
