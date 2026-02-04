import React, { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, FolderUp, FileText, AlertCircle } from 'lucide-react';

interface FileDropZoneProps {
    onFilesSelected: (files: File[]) => void;
    disabled?: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({ onFilesSelected, disabled = false }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const fileList = Array.from(e.dataTransfer.files);
            onFilesSelected(fileList);
        }
    };

    const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const fileList = Array.from(e.target.files);
            onFilesSelected(fileList);
            // Reset input so same files can be selected again
            e.target.value = '';
        }
    };

    return (
        <div
            className={`
                relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200
                ${isDragging
                    ? 'border-cyan-500 bg-cyan-500/5'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="flex flex-col items-center justify-center space-y-4">
                <div className={`p-4 rounded-full ${isDragging ? 'bg-cyan-500/20' : 'bg-slate-800'}`}>
                    <UploadCloud className={`w-10 h-10 ${isDragging ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>

                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white">
                        Drag and drop files or folders
                    </h3>
                    <p className="text-sm text-slate-400 max-w-sm mx-auto">
                        Support for Images, CSV, KML/KMZ, and ZIP archives.
                        <br />
                        Folder structure will be preserved.
                    </p>
                </div>

                <div className="flex items-center gap-4 pt-4">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-slate-700"
                    >
                        <FileText className="w-4 h-4" />
                        Select Files
                    </button>

                    <span className="text-slate-600 font-medium">or</span>

                    <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        disabled={disabled}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-slate-700"
                    >
                        <FolderUp className="w-4 h-4" />
                        Select Folder
                    </button>
                </div>
            </div>

            {/* Hidden Inputs */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                className="hidden"
                multiple
            />
            <input
                type="file"
                ref={folderInputRef}
                onChange={handleFileInput}
                className="hidden"
                // @ts-ignore - webkitdirectory is non-standard but supported
                webkitdirectory=""
                directory=""
            />
        </div>
    );
};
