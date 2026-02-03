import React, { useState, useEffect } from 'react';
import {
    MapPin as MapPinIcon, User, Calendar, Tag, ChevronRight,
    ArrowRight, Save, Trash2, List, Filter,
    Upload, FileText, CheckCircle, AlertCircle
} from 'lucide-react';
import apiClient from '../src/services/apiClient';
import { Workbook, WorkItem } from '../types';

const WorkItemsDashboard: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [uploadPreview, setUploadPreview] = useState<any>(null);
    const [mapping, setMapping] = useState<any>({
        title: '',
        description: '',
        assignedTo: '',
        externalId: '',
        dueDate: '',
        priority: ''
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
    const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const response = await apiClient.get('/workbooks/history'); // Note: I need to add this to the controller
            if (response.data.success) {
                setWorkbooks(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            handleInitialUpload(e.target.files[0]);
        }
    };

    const handleInitialUpload = async (file: File) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scopeType', 'global');

        try {
            const response = await apiClient.post('/workbooks/upload', formData);
            if (response.data.success) {
                setUploadPreview(response.data.data);
                // Auto-map if possible
                const cols = response.data.data.columns;
                const newMapping = { ...mapping };
                cols.forEach((col: string) => {
                    const lCol = col.toLowerCase();
                    if (lCol.includes('title') || lCol.includes('task') || lCol.includes('subject')) newMapping.title = col;
                    if (lCol.includes('desc') || lCol.includes('detail') || lCol.includes('body')) newMapping.description = col;
                    if (lCol.includes('assign') || lCol.includes('user') || lCol.includes('pilot')) newMapping.assignedTo = col;
                    if (lCol.includes('id') || lCol.includes('ref')) newMapping.externalId = col;
                    if (lCol.includes('date') || lCol.includes('due')) newMapping.dueDate = col;
                    if (lCol.includes('prio')) newMapping.priority = col;
                });
                setMapping(newMapping);
            }
        } catch (error) {
            alert('Upload failed: ' + error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleProcess = async () => {
        if (!uploadPreview || !mapping.title) {
            alert('Please complete mapping first');
            return;
        }

        setIsProcessing(true);
        try {
            const response = await apiClient.post('/workbooks/process', {
                rows: uploadPreview.preview, // In real app, might want to send full set or different structure
                mapping,
                scopeType: 'global',
                filename: file?.name,
                storageUrl: 'local://' + file?.name // Placeholder
            });
            if (response.data.success) {
                alert('Imported ' + response.data.data.imported + ' items');
                setUploadPreview(null);
                setFile(null);
                fetchHistory();
                setActiveTab('history');
            }
        } catch (error) {
            alert('Processing failed: ' + error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-slate-900 min-h-screen text-white p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <List className="text-blue-400" size={32} />
                            Work Items & Checklists
                        </h1>
                        <p className="text-slate-400 mt-1">Manage bulk task assignment via spreadsheet upload</p>
                    </div>
                    <div className="flex bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`px-4 py-2 rounded-md transition-all ${activeTab === 'upload' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-700'}`}
                        >
                            <Upload size={18} className="inline mr-2" /> Upload
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-md transition-all ${activeTab === 'history' ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-700'}`}
                        >
                            <FileText size={18} className="inline mr-2" /> History
                        </button>
                    </div>
                </div>

                {activeTab === 'upload' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Upload Zone */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${file ? 'border-green-500 bg-green-500/5' : 'border-slate-700 hover:border-blue-500 bg-slate-800/50'}`}>
                                <input
                                    type="file"
                                    id="fileInput"
                                    className="hidden"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileChange}
                                />
                                <label htmlFor="fileInput" className="cursor-pointer">
                                    <div className="bg-slate-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-600">
                                        <Upload className={file ? 'text-green-400' : 'text-blue-400'} size={32} />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">{file ? file.name : 'Select Workbook'}</h3>
                                    <p className="text-sm text-slate-400 mb-4">Support XLSX, XLS, and CSV files</p>
                                    <span className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                        Browse Files
                                    </span>
                                </label>
                            </div>

                            {uploadPreview && (
                                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                                        <MapPinIcon size={18} className="text-blue-400" />
                                        Column Mapping
                                    </h3>
                                    <div className="space-y-4">
                                        {Object.keys(mapping).map((field) => (
                                            <div key={field}>
                                                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                                                    {field.replace(/([A-Z])/g, ' $1')}
                                                    {field === 'title' && <span className="text-red-400 ml-1">*</span>}
                                                </label>
                                                <select
                                                    value={mapping[field]}
                                                    onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                                                >
                                                    <option value="">Select Column...</option>
                                                    {uploadPreview.columns.map((col: string) => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleProcess}
                                        disabled={isProcessing || !mapping.title}
                                        className="w-full mt-8 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                                    >
                                        {isProcessing ? 'Processing...' : 'Bulk Create Work Items'}
                                        <ArrowRight size={20} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Preview Zone */}
                        <div className="lg:col-span-2">
                            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                                <div className="bg-slate-700/50 px-6 py-4 border-b border-slate-700">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <CheckCircle size={18} className="text-green-400" />
                                        Data Preview
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    {uploadPreview ? (
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
                                                <tr>
                                                    {uploadPreview.columns.map((col: string) => (
                                                        <th key={col} className="px-6 py-3 font-medium border-b border-slate-700 whitespace-nowrap">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700">
                                                {uploadPreview.preview.map((row: any, i: number) => (
                                                    <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                                                        {uploadPreview.columns.map((col: string) => (
                                                            <td key={col} className="px-6 py-4 whitespace-nowrap">{row[col]}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="py-20 text-center text-slate-500">
                                            <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                            <p>Upload a file to see a preview of the data</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-xl text-center">
                        <AlertCircle size={48} className="text-blue-400 opacity-50 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
                        <p className="text-slate-400">The workbook history and management view is currently under development.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkItemsDashboard;
