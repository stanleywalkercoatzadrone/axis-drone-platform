export const colors = {
    // Brand
    brand: {
        primary: 'var(--color-brand-primary)', // Maps to tailwind text-brand-primary or bg-brand-primary via class
        accent: 'var(--color-brand-accent)',
    },
    // Surface
    surface: {
        primary: 'bg-slate-900',
        secondary: 'bg-slate-800',
        tertiary: 'bg-slate-950', // Canvas
    },
    // Text
    text: {
        primary: 'text-slate-50',
        secondary: 'text-slate-400',
        inverse: 'text-slate-900',
    },
    // Border
    border: {
        default: 'border-slate-800',
        subtle: 'border-slate-800/50',
        active: 'border-slate-700',
    },
    // Status
    status: {
        success: 'text-status-success',
        warning: 'text-status-warning',
        error: 'text-status-error',
        info: 'text-status-info',
    }
} as const;

// We will use these mostly as class string mappings for now
// to leverage the generic Tailwind config.
