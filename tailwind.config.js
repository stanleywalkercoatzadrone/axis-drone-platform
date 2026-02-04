/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./index.tsx"
    ],
    theme: {
        extend: {
            colors: {
                // Enterprise Slate Palette (Premium Dark)
                slate: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',  // Secondary Surface
                    900: '#0f172a',  // Primary Surface
                    950: '#020617',  // Canvas / Sidebar (Darkest)
                },
                // Semantic Roles
                brand: {
                    primary: '#3b82f6', // Indigo-500 equivalent
                    accent: '#00E5FF',  // Cyan (legacy brand)
                },
                status: {
                    success: '#10b981', // Emerald-500
                    warning: '#f59e0b', // Amber-500
                    error: '#ef4444',   // Red-500
                    info: '#3b82f6',    // Blue-500
                    risk: '#dc2626',    // Red-600 (SLA)
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                'glow': '0 0 20px rgba(59, 130, 246, 0.15)', // Subtle blue glow
                'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            }
        },
    },
    plugins: [],
}
