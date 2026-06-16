import { useState, useEffect } from 'react';

interface TMDBSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (item: any) => void;
    onSkip?: () => void; // Optional skip handler
    initialQuery?: string;
    category?: string;
}

export default function TMDBSearchModal({ isOpen, onClose, onSelect, onSkip, initialQuery = '', category: initialCategory = 'Movies' }: TMDBSearchModalProps) {
    const [query, setQuery] = useState(initialQuery);
    const [searchCategory, setSearchCategory] = useState(initialCategory || 'Movies'); // Local state for category
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setQuery(initialQuery);
            setSearchCategory(initialCategory || 'Movies');
            if (initialQuery) handleSearch(initialQuery, initialCategory || 'Movies');
            else {
                setResults([]);
            }
        }
    }, [isOpen, initialQuery, initialCategory]);

    const handleSearch = async (q: string, cat: string) => {
        if (!q.trim()) return;
        setLoading(true);
        // passing 'All' or user selection to backend
        const res = await window.electronAPI.invoke('tmdb-search', q.trim(), cat);
        setResults(res || []);
        setLoading(false);
    };

    // ... (handleResultSelect remains same)

    const handleResultSelect = async (result: any) => {
        setLoading(true);
        try {
            // Fetch full details (director, etc.)
            const details = await window.electronAPI.invoke('tmdb-get-details', result.id, result.media_type || searchCategory);

            if (details && !details.error) {
                onSelect({
                    title: details.title,
                    poster: details.localImagePath,
                    genre: details.genre,
                    director: details.director,
                    year: result.year,
                    media_type: result.media_type // Pass media_type back
                });
                // onClose(); // Parent handles closing or next item
            } else {
                console.error("Failed to fetch details:", details?.error);
                alert("Failed to fetch details from TMDB. Please try again.");
            }
        } catch (error) {
            console.error("Selection error:", error);
            alert("An error occurred while fetching details.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] backdrop-blur-md p-4">
            <div className="bg-[#1e1e1e] rounded-xl border border-gray-800 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white">Search TMDB</h2>
                        <select
                            value={searchCategory}
                            onChange={(e) => {
                                setSearchCategory(e.target.value);
                                if (query) handleSearch(query, e.target.value);
                            }}
                            className="bg-[#121212] border border-gray-700 text-white text-sm px-2 py-1 rounded outline-none focus:border-blue-500"
                        >
                            <option value="Movies">Movies</option>
                            <option value="Series">Series</option>
                            <option value="Anime">Anime</option>
                            <option value="All">All Libraries</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        {onSkip && (
                            <button onClick={onSkip} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white transition-colors">
                                Skip This Item
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex gap-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query, searchCategory)}
                            placeholder="Search title..."
                            className="flex-1 bg-[#121212] border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none"
                            autoFocus
                        />
                        <button onClick={() => handleSearch(query, searchCategory)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium">Search</button>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center text-gray-500">Loading...</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 overflow-y-auto max-h-[60vh] p-2">
                            {results.map(item => (
                                <div key={item.id} onClick={() => handleResultSelect(item)}
                                    className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden hover:border-blue-500 cursor-pointer transition-all hover:transform hover:scale-105 group relative">
                                    <div className="aspect-[2/3] bg-gray-900 relative">
                                        {item.poster_path ? (
                                            <img src={item.poster_path} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-700">No Image</div>
                                        )}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Select</span>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h3 className="font-bold text-sm text-gray-200 line-clamp-1">{item.title}</h3>
                                        <p className="text-xs text-gray-500 mt-1">{item.year} • {item.media_type}</p>
                                    </div>
                                </div>
                            ))}
                            {results.length === 0 && !loading && <div className="col-span-full text-center py-10 text-gray-600">No results found</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
