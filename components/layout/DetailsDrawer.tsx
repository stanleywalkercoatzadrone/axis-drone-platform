import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    width?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const DetailsDrawer: React.FC<DetailsDrawerProps> = ({
    isOpen,
    onClose,
    title,
    children,
    width = 'lg'
}) => {
    const drawerRef = useRef<HTMLDivElement>(null);

    // Close on escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Handle width classes
    const getWidthClass = () => {
        switch (width) {
            case 'md': return 'max-w-md';
            case 'lg': return 'max-w-lg';
            case 'xl': return 'max-w-xl';
            case '2xl': return 'max-w-2xl';
            case 'full': return 'max-w-full';
            default: return 'max-w-lg';
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            ></div>

            {/* Slide-over panel */}
            <div
                className={`fixed inset-y-0 right-0 z-50 flex pointer-events-none ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    } transition-transform duration-300 ease-in-out`}
            >
                <div
                    ref={drawerRef}
                    className={`w-screen ${getWidthClass()} bg-slate-900 border-l border-slate-800 shadow-2xl pointer-events-auto flex flex-col h-full`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                        <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <span className="sr-only">Close panel</span>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
};
