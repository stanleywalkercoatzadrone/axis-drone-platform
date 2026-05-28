import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Fault, Severity } from '../../../src/types';

interface FaultTaggingModalProps {
    isOpen: boolean;
    onClose: () => void;
    image: { id: string; url: string };
    onSaveFault: (fault: Fault) => void;
    existingFaults: Fault[];
}

const FaultTaggingModal: React.FC<FaultTaggingModalProps> = ({ isOpen, onClose, image, onSaveFault, existingFaults }) => {
    const [faultDescription, setFaultDescription] = useState('');

    if (!isOpen) return null;

    const handleSave = () => {
        if (!faultDescription.trim()) return;
        
        const newFault: Fault = {
            id: `fault-${Date.now()}`,
            imageId: image.id,
            description: faultDescription,
            severity: Severity.MEDIUM,
            type: 'General',
            x: 0,
            y: 0,
            createdAt: new Date().toISOString()
        };
        
        onSaveFault(newFault);
        setFaultDescription('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-white">Tag Fault in Image</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto">
                    {image.url && (
                        <div className="mb-4 rounded-lg overflow-hidden bg-black flex items-center justify-center h-64 border border-slate-800">
                            <img src={image.url} alt="Fault tagging" className="max-h-full max-w-full object-contain" />
                        </div>
                    )}
                    
                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Fault Description</label>
                        <textarea
                            value={faultDescription}
                            onChange={(e) => setFaultDescription(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                            rows={3}
                            placeholder="Describe the fault..."
                        />
                    </div>
                    
                    {existingFaults.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Existing Faults</label>
                            <div className="space-y-2">
                                {existingFaults.map(f => (
                                    <div key={f.id} className="bg-slate-800 p-2 rounded-lg text-sm text-slate-300">
                                        {f.description}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors flex items-center gap-2">
                        <Check className="w-4 h-4" /> Save Fault
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FaultTaggingModal;
