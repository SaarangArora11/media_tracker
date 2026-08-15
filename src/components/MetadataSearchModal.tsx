import { useState, useEffect } from 'react';

export type SearchProvider = 'TMDB' | 'AniList' | 'GoogleBooks';

interface MetadataSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (item: any) => void;
    onSkip?: () => void;
    initialQuery?: string;
    category?: string;
}

export default function MetadataSearchModal({
    isOpen,
    onClose,
    onSelect,
    onSkip,
    initialQuery = '',
    category: initialCategory = 'Movies'
}: MetadataSearchModalProps) {
    const [query, setQuery] = useState(initialQuery);
    const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'Movies');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<{ code?: string | number; message: string } | null>(null);

    // Determine the default search provider based on category
    const getProviderForCategory = (cat: string): SearchProvider => {
        if (cat === 'Books') return 'GoogleBooks';
        if (cat === 'Anime' || cat === 'Manga') return 'AniList';
        return 'TMDB'; // Movies, Series, Games (fallback)
    };

    const [provider, setProvider] = useState<SearchProvider>(getProviderForCategory(initialCategory));

    useEffect(() => {
        if (isOpen) {
            setQuery(initialQuery);
            const cat = initialCategory || 'Movies';
            setSelectedCategory(cat);
            const prov = getProviderForCategory(cat);
            setProvider(prov);
            setErrorMessage(null);
            if (initialQuery) {
                handleSearch(initialQuery, cat, prov);
            } else {
                setResults([]);
            }
        }
    }, [isOpen, initialQuery, initialCategory]);

    const handleCategoryChange = (cat: string) => {
        setSelectedCategory(cat);
        const prov = getProviderForCategory(cat);
        setProvider(prov);
        if (query.trim()) {
            handleSearch(query, cat, prov);
        }
    };

    const handleProviderChange = (prov: SearchProvider) => {
        setProvider(prov);
        // Sync category if necessary
        if (prov === 'GoogleBooks' && selectedCategory !== 'Books') {
            setSelectedCategory('Books');
        } else if (prov === 'AniList' && selectedCategory !== 'Anime' && selectedCategory !== 'Manga') {
            setSelectedCategory('Anime');
        } else if (prov === 'TMDB' && selectedCategory !== 'Movies' && selectedCategory !== 'Series') {
            setSelectedCategory('Movies');
        }

        if (query.trim()) {
            handleSearch(query, selectedCategory, prov);
        }
    };

    const handleSearch = async (q: string, cat: string, prov: SearchProvider) => {
        if (!q.trim()) return;
        setLoading(true);
        setErrorMessage(null);

        try {
            let res: any = null;
            if (prov === 'GoogleBooks') {
                res = await window.electronAPI.invoke('books-search', q.trim());
            } else if (prov === 'AniList') {
                res = await window.electronAPI.invoke('anilist-search', q.trim(), cat);
            } else {
                // TMDB
                res = await window.electronAPI.invoke('tmdb-search', q.trim(), cat);
            }

            if (res && res.success === false) {
                setResults([]);
                setErrorMessage({
                    code: res.code || 'SEARCH_ERROR',
                    message: res.error || 'Failed to search metadata service'
                });
            } else if (res && res.success && Array.isArray(res.results)) {
                setResults(res.results);
            } else if (Array.isArray(res)) {
                setResults(res);
            } else {
                setResults([]);
            }
        } catch (err: any) {
            setResults([]);
            setErrorMessage({
                code: err?.code || 'IPC_ERROR',
                message: err?.message || 'Failed to communicate with metadata service'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleResultSelect = async (result: any) => {
        setLoading(true);
        setErrorMessage(null);

        try {
            let details: any = null;
            if (provider === 'GoogleBooks') {
                details = await window.electronAPI.invoke('books-get-details', result.id);
            } else if (provider === 'AniList') {
                details = await window.electronAPI.invoke('anilist-get-details', result.id, selectedCategory);
            } else {
                // TMDB
                details = await window.electronAPI.invoke('tmdb-get-details', result.id, result.media_type || selectedCategory);
            }

            if (details && details.success !== false) {
                // Map to normalized structure from details
                const selectedData = {
                    title: details.title || result.title,
                    category: details.category || result.category || selectedCategory,
                    poster: details.localImagePath || details.poster_path || result.poster_path,
                    genre: details.genre || result.genre || '',
                    author: details.author || result.author || '',
                    director: details.director || result.director || '',
                    studio: details.studio || result.studio || '',
                    year: details.year || result.year || '',
                    overview: details.overview || result.overview || '',
                    media_type: result.media_type
                };

                onSelect(selectedData);
            } else if (result && result.title) {
                // Fallback to result data directly so the user is never blocked
                const fallbackData = {
                    title: result.title,
                    category: result.category || selectedCategory,
                    poster: result.poster_path,
                    genre: result.genre || '',
                    author: result.author || '',
                    director: result.director || '',
                    studio: result.studio || '',
                    year: result.year || '',
                    overview: result.overview || '',
                    media_type: result.media_type
                };

                onSelect(fallbackData);
            } else {
                const errCode = details?.code || 'DETAILS_FETCH_FAILED';
                const errMsg = details?.error || 'Failed to fetch details from metadata service.';
                setErrorMessage({ code: errCode, message: errMsg });
                alert(`Failed to fetch details\n\nError Code: ${errCode}\nError Message: ${errMsg}`);
            }
        } catch (error: any) {
            console.error("Selection error:", error);
            // Even if an unhandled error occurs, try to select with result data if available
            if (result && result.title) {
                onSelect({
                    title: result.title,
                    category: result.category || selectedCategory,
                    poster: result.poster_path,
                    genre: result.genre || '',
                    author: result.author || '',
                    director: result.director || '',
                    studio: result.studio || '',
                    year: result.year || '',
                    overview: result.overview || '',
                    media_type: result.media_type
                });
            } else {
                const errCode = error?.code || 'UNKNOWN_ERROR';
                const errMsg = error?.message || 'An error occurred while fetching item details.';
                setErrorMessage({ code: errCode, message: errMsg });
                alert(`Failed to fetch details\n\nError Code: ${errCode}\nError Message: ${errMsg}`);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const providerLabels: Record<SearchProvider, { name: string; icon: string; badgeColor: string }> = {
        TMDB: { name: 'TMDB', icon: '🎬', badgeColor: 'bg-blue-600/20 text-blue-400 border-blue-500/30' },
        AniList: { name: 'AniList', icon: '🌸', badgeColor: 'bg-pink-600/20 text-pink-400 border-pink-500/30' },
        GoogleBooks: { name: 'Google Books', icon: '📖', badgeColor: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e1e1e] rounded-xl border border-gray-800 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#181818]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-600/10 text-blue-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                Search Online Metadata
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${providerLabels[provider].badgeColor} font-medium`}>
                                    {providerLabels[provider].icon} {providerLabels[provider].name}
                                </span>
                            </h2>
                            <p className="text-gray-400 text-xs mt-0.5">Find posters, authors, cast, studios, and genres automatically</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        {/* Provider Selector Tabs */}
                        <div className="flex bg-[#121212] p-1 rounded-lg border border-gray-800 text-xs">
                            <button
                                onClick={() => handleProviderChange('TMDB')}
                                className={`px-2.5 py-1 rounded font-medium transition-all ${provider === 'TMDB' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                title="Movies & Series via TMDB"
                            >
                                🎬 TMDB
                            </button>
                            <button
                                onClick={() => handleProviderChange('AniList')}
                                className={`px-2.5 py-1 rounded font-medium transition-all ${provider === 'AniList' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                title="Anime & Manga via AniList"
                            >
                                🌸 AniList
                            </button>
                            <button
                                onClick={() => handleProviderChange('GoogleBooks')}
                                className={`px-2.5 py-1 rounded font-medium transition-all ${provider === 'GoogleBooks' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                title="Books via Google Books"
                            >
                                📖 Books
                            </button>
                        </div>

                        {onSkip && (
                            <button onClick={onSkip} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white border border-gray-700 transition-colors">
                                Skip
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-white p-1">✕</button>
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="bg-red-900/40 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3 shadow-inner animate-in fade-in duration-200">
                            <div>
                                <span className="font-bold text-red-400">Error [{errorMessage.code}]:</span>{' '}
                                <span>{errorMessage.message}</span>
                            </div>
                            <button
                                onClick={() => setErrorMessage(null)}
                                className="text-red-400 hover:text-red-200 text-xs font-bold uppercase tracking-wider bg-red-950/50 px-2 py-1 rounded border border-red-800"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {/* Search Controls */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query, selectedCategory, provider)}
                                placeholder={
                                    provider === 'GoogleBooks'
                                        ? "Search book title or author..."
                                        : provider === 'AniList'
                                        ? "Search anime or manga title..."
                                        : "Search movie or series title..."
                                }
                                className="w-full bg-[#121212] border border-gray-700 rounded-lg pl-4 pr-10 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 outline-none text-sm transition-colors"
                                autoFocus
                            />
                            {query && (
                                <button
                                    onClick={() => setQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Category Dropdown */}
                        <select
                            value={selectedCategory}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="bg-[#121212] border border-gray-700 text-white text-sm px-3 py-2.5 rounded-lg outline-none focus:border-blue-500"
                        >
                            <option value="Movies">Movies</option>
                            <option value="Series">Series</option>
                            <option value="Anime">Anime</option>
                            <option value="Manga">Manga</option>
                            <option value="Books">Books</option>
                        </select>

                        <button
                            onClick={() => handleSearch(query, selectedCategory, provider)}
                            disabled={loading || !query.trim()}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-all shadow-md hover:shadow-blue-500/20"
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </div>

                    {/* Results Grid */}
                    {loading ? (
                        <div className="py-24 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-3"></div>
                            <p className="text-gray-400 text-sm">Searching {providerLabels[provider].name}...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto max-h-[58vh] p-1">
                            {results.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleResultSelect(item)}
                                    className="bg-[#151515] rounded-xl border border-gray-800 hover:border-blue-500 overflow-hidden cursor-pointer transition-all hover:transform hover:scale-[1.03] group flex flex-col shadow-md"
                                >
                                    <div className="aspect-[2/3] bg-gray-900 relative overflow-hidden">
                                        {item.poster_path ? (
                                            <img
                                                src={item.poster_path}
                                                alt={item.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 p-2 text-center text-xs">
                                                <span className="text-2xl mb-1">{providerLabels[provider].icon}</span>
                                                <span>No Cover</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                                            <span className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                                Select
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-3 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-bold text-xs text-gray-200 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
                                                {item.title}
                                            </h3>
                                            {(item.author || item.director || item.studio) && (
                                                <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
                                                    {item.author || item.director || item.studio}
                                                </p>
                                            )}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-gray-800/60 flex justify-between items-center text-[10px] text-gray-500">
                                            <span>{item.year || 'Unknown'}</span>
                                            <span className="capitalize px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                                                {item.media_type || selectedCategory}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {results.length === 0 && !loading && !errorMessage && (
                                <div className="col-span-full text-center py-20 text-gray-500">
                                    <p className="text-base font-medium">No results found</p>
                                    <p className="text-xs mt-1 text-gray-600">Try searching for a different title or switch the provider above</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
