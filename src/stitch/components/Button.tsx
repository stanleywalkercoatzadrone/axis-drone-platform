import React from 'react';
import { cn } from '../utils/cn';
import { colors, typography, shadows } from '../tokens';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {

        const baseStyles = cn(
            'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
            typography.weights.medium,
            typography.sizes.sm
        );

        const variants = {
            primary: cn('bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-glow focus:ring-blue-500 border border-blue-400/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]', colors.status.info),
            secondary: 'bg-slate-800/60 backdrop-blur-md text-slate-50 hover:bg-slate-700/80 focus:ring-slate-700 border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
            ghost: 'bg-transparent text-slate-300 hover:text-white hover:bg-white/5',
            destructive: 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-500 hover:to-rose-500 focus:ring-red-500 shadow-sm border border-red-400/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]',
            outline: 'border border-slate-700/50 bg-slate-900/30 backdrop-blur-md text-slate-300 hover:text-white hover:border-slate-500 hover:bg-slate-800/50',
        };

        const sizes = {
            sm: 'h-8 px-3 text-xs',
            md: 'h-10 px-4 py-2',
            lg: 'h-12 px-6 text-base',
            icon: 'h-10 w-10 p-0',
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
