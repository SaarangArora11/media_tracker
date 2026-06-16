import { useState, useEffect } from 'react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (isOpen) loadSettings();
    }, [isOpen]);

    const loadSettings = async () => {
        const key = await window.electronAPI.invoke('get-setting', 'tmdb_api_key');
        if (key) setApiKey(key);
    };

    const handleSave = async () => {
        await window.electronAPI.invoke('save-setting', { key: 'tmdb_api_key', value: apiKey });
        setStatus('Saved!');
        setTimeout(() => setStatus(''), 2000);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-[#1e1e1e] rounded-xl border border-gray-800 w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Settings</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">TMDB API Key</label>
                            <input
                                type="text"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full bg-[#121212] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                placeholder="Enter your TMDB API Key"
                            />
                            <p className="text-gray-500 text-xs mt-2">
                                Required for auto-fetching posters and details.
                                <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-blue-400 hover:underline ml-1">Get key here</a>
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button onClick={onClose} className="px-5 py-2 rounded-lg text-gray-400 hover:text-white font-medium transition-colors">Cancel</button>
                        <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20">
                            {status || 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
