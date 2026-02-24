import React from 'react';
import { cn } from '../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, ...props }, ref) => {
        return (
            <div className="w-full space-y-2">
                {label && (
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-400">
                        {label}
                    </label>
                )}
                <input
                    type={type}
                    className={cn(
                        'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
                        'disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
                        'dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50',
                        error && 'border-red-500 focus:ring-red-500/50 focus:border-red-500',
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {error && <p className="text-xs text-red-500 animate-in slide-in-from-top-1">{error}</p>}
            </div>
        );
    }
);
Input.displayName = 'Input';
