import React from "react";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";

export const LoadingOverlay: React.FC<{ message?: string }> = ({ message = "Processing Protocol..." }) => (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-300 animate-pulse">{message}</span>
        </div>
    </div>
);

export const LoadingSpinner: React.FC<{ size?: "sm" | "md" | "lg" }> = ({ size = "md" }) => {
    const sizes = {
        sm: "w-4 h-4",
        md: "w-8 h-8",
        lg: "w-12 h-12"
    };
    return <Loader2 className={`${sizes[size]} text-blue-500 animate-spin`} />;
};

export const ErrorState: React.FC<{ message?: string; onRetry?: () => void }> = ({
    message = "Operation Fragmented. Please retry.",
    onRetry
}) => (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-red-500/5 border border-red-500/10 rounded-2xl">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4 opacity-80" />
        <h3 className="text-lg font-bold text-red-200 mb-2 uppercase tracking-tight">System Exception</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">{message}</p>
        {onRetry && (
            <button
                onClick={onRetry}
                className="flex items-center gap-2 px-6 py-2 bg-red-500 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
            >
                <RefreshCw className="w-3.5 h-3.5" />
                Force Reconnect
            </button>
        )}
    </div>
);
