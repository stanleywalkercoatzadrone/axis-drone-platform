import React from 'react';
import { Check, Circle } from 'lucide-react';

interface OnboardingStepperProps {
    currentStep: number;
    steps: {
        id: number;
        title: string;
        description: string;
    }[];
}

const OnboardingStepper: React.FC<OnboardingStepperProps> = ({ currentStep, steps }) => {
    return (
        <div className="relative flex justify-between items-center w-full max-w-4xl mx-auto mb-12 px-4">
            {/* Connection Lines */}
            <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-800 -z-10" />
            <div
                className="absolute top-5 left-8 h-0.5 bg-blue-500 transition-all duration-500 -z-10"
                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`, maxWidth: 'calc(100% - 4rem)' }}
            />

            {steps.map((step) => {
                const isCompleted = step.id < currentStep;
                const isActive = step.id === currentStep;

                return (
                    <div key={step.id} className="flex flex-col items-center gap-3">
                        <div
                            className={`
                                w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2
                                ${isCompleted ? 'bg-blue-600 border-blue-600' :
                                    isActive ? 'bg-slate-900 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' :
                                        'bg-slate-900 border-slate-700 text-slate-500'}
                            `}
                        >
                            {isCompleted ? (
                                <Check className="w-5 h-5 text-white" />
                            ) : (
                                <span className={isActive ? 'text-blue-500 font-bold' : ''}>{step.id}</span>
                            )}
                        </div>
                        <div className="text-center">
                            <h3 className={`text-sm font-semibold transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                {step.title}
                            </h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest hidden sm:block">
                                {step.description}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default OnboardingStepper;
