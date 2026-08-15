import { useState, useEffect } from 'react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [tmdbApiKey, setTmdbApiKey] = useState('');
    const [googleBooksApiKey, setGoogleBooksApiKey] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (isOpen) loadSettings();
    }, [isOpen]);

    const loadSettings = async () => {
        const tmdbKey = await window.electronAPI.invoke('get-setting', 'tmdb_api_key');
        if (tmdbKey) setTmdbApiKey(tmdbKey);

        const booksKey = await window.electronAPI.invoke('get-setting', 'google_books_api_key');
        if (booksKey) setGoogleBooksApiKey(booksKey);
    };

    const handleSave = async () => {
        await window.electronAPI.invoke('save-setting', { key: 'tmdb_api_key', value: tmdbApiKey.trim() });
        await window.electronAPI.invoke('save-setting', { key: 'google_books_api_key', value: googleBooksApiKey.trim() });
        setStatus('Saved!');
        setTimeout(() => setStatus(''), 2000);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e1e1e] rounded-xl border border-gray-800 w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
                        <div>
                            <h2 className="text-xl font-bold text-white">API & Metadata Settings</h2>
                            <p className="text-gray-400 text-xs mt-0.5">Configure metadata providers for auto-fetching covers & info</p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                    </div>

                    <div className="space-y-6">
                        {/* TMDB Provider */}
                        <div className="bg-[#151515] p-4 rounded-xl border border-gray-800">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                    <span>🎬</span> TMDB API Key (Movies & Series)
                                </label>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${tmdbApiKey ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-yellow-950 text-yellow-400 border border-yellow-800'}`}>
                                    {tmdbApiKey ? 'Configured' : 'Required for Movies'}
                                </span>
                            </div>
                            <input
                                type="password"
                                value={tmdbApiKey}
                                onChange={(e) => setTmdbApiKey(e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-xs"
                                placeholder="Enter TMDB API Key (v3 Key or Bearer Token)"
                            />
                            <p className="text-gray-500 text-[11px] mt-2">
                                Required for fetching movie/series posters & cast.
                                <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-1">Get free key →</a>
                            </p>
                        </div>

                        {/* Google Books Provider */}
                        <div className="bg-[#151515] p-4 rounded-xl border border-gray-800">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                    <span>📖</span> Google Books API Key (Books)
                                </label>
                                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-950 text-blue-400 border border-blue-800">
                                    Optional (Free Tier Active)
                                </span>
                            </div>
                            <input
                                type="password"
                                value={googleBooksApiKey}
                                onChange={(e) => setGoogleBooksApiKey(e.target.value)}
                                className="w-full bg-[#1e1e1e] border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-xs"
                                placeholder="Optional: Enter Google Cloud Books API Key"
                            />
                            <p className="text-gray-500 text-[11px] mt-2">
                                Works out-of-the-box without a key. Add an API key for higher rate limits.
                                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-1">Google Console →</a>
                            </p>
                        </div>

                        {/* AniList Provider Info */}
                        <div className="bg-[#151515] p-4 rounded-xl border border-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">🌸</span>
                                <div>
                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">AniList (Anime & Manga)</h3>
                                    <p className="text-gray-400 text-[11px]">Free public GraphQL API enabled (no key required)</p>
                                </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                                Connected
                            </span>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-gray-800 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white font-medium text-sm transition-colors">Cancel</button>
                        <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2 rounded-lg text-sm transition-all shadow-lg hover:shadow-blue-500/20">
                            {status || 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
