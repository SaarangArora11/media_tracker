import React, { useState } from 'react';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (category: string, status: string, method: 'Manual' | 'TMDB') => void;
    fileData: { titleCount: number; path: string } | null;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, fileData }) => {
    const [category, setCategory] = useState('Movies');
    const [status, setStatus] = useState('Watching');

    if (!isOpen || !fileData) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] rounded-xl w-full max-w-md border border-gray-800 shadow-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Import Text File</h2>

                <div className="mb-6 p-4 bg-[#252525] rounded border border-gray-700">
                    <p className="text-gray-300">Found <strong className="text-blue-400">{fileData.titleCount}</strong> titles.</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{fileData.path}</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Import as Media Type</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-[#2a2a2a] border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                        >
                            {['Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Set Initial Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full bg-[#2a2a2a] border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                        >
                            {['Watching', 'To Consume', 'Consumed'].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="pt-6 flex justify-end gap-3 flex-wrap">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-300 hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onImport(category, status, 'Manual')}
                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium"
                    >
                        Import Manually
                    </button>
                    <button
                        onClick={() => onImport(category, status, 'TMDB')}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium shadow-lg hover:shadow-blue-500/20"
                    >
                        Import via TMDB
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
