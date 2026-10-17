import React, { useState } from 'react';
import type { MediaItem, MediaCategory, AdvancedSearchFilters } from '../types';
import CategoryIcon from './CategoryIcon';
import MediaInspectionModal from './MediaInspectionModal';

interface DiscoverViewProps {
    existingItems: MediaItem[];
    onAddToLibrary: (newItem: MediaItem) => Promise<void>;
}

export type SearchProvider = 'TMDB' | 'AniList' | 'GoogleBooks';

const DiscoverView: React.FC<DiscoverViewProps> = ({ existingItems, onAddToLibrary }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<MediaCategory>('Movies');
    const [provider, setProvider] = useState<SearchProvider>('TMDB');

    // Advanced search state
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({
        year: '',
        creator: ''
    });

    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Selected item for inspection
    const [inspectedItem, setInspectedItem] = useState<any | null>(null);
    const [isInspecting, setIsInspecting] = useState(false);

    // Auto-update default provider when category changes
    const handleCategoryChange = (cat: MediaCategory) => {
        setSelectedCategory(cat);
        let newProv: SearchProvider = 'TMDB';
        if (cat === 'Books') newProv = 'GoogleBooks';
        else if (cat === 'Anime' || cat === 'Manga') newProv = 'AniList';
        setProvider(newProv);

        if (searchQuery.trim()) {
            executeSearch(searchQuery, cat, newProv, advancedFilters);
        }
    };

    const handleProviderChange = (prov: SearchProvider) => {
        setProvider(prov);
        if (prov === 'GoogleBooks' && selectedCategory !== 'Books') {
            setSelectedCategory('Books');
        } else if (prov === 'AniList' && selectedCategory !== 'Anime' && selectedCategory !== 'Manga') {
            setSelectedCategory('Anime');
        } else if (prov === 'TMDB' && selectedCategory !== 'Movies' && selectedCategory !== 'Series') {
            setSelectedCategory('Movies');
        }

        if (searchQuery.trim()) {
            executeSearch(searchQuery, selectedCategory, prov, advancedFilters);
        }
    };

    const executeSearch = async (
        query: string,
        cat: MediaCategory,
        prov: SearchProvider,
        filters: AdvancedSearchFilters
    ) => {
        if (!query.trim()) return;
        setLoading(true);
        setErrorMsg(null);

        try {
            let res: any;
            if (prov === 'TMDB') {
                res = await window.electronAPI.invoke('tmdb-search', query, cat, filters);
            } else if (prov === 'GoogleBooks') {
                res = await window.electronAPI.invoke('books-search', query, filters);
            } else if (prov === 'AniList') {
                res = await window.electronAPI.invoke('anilist-search', query, cat, filters);
            }

            if (res && res.success) {
                setResults(res.results || []);
            } else {
                setResults([]);
                if (res?.error) setErrorMsg(res.error);
            }
        } catch (err: any) {
            console.error('Discover search failed:', err);
            setErrorMsg(err.message || 'Search request failed.');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        executeSearch(searchQuery, selectedCategory, provider, advancedFilters);
    };

    const handleInspect = async (item: any) => {
        // Fetch full details if not already loaded
        try {
            let detailsRes: any = null;
            if (item.source === 'tmdb') {
                detailsRes = await window.electronAPI.invoke('tmdb-get-details', item.id, item.media_type || selectedCategory);
            } else if (item.source === 'google_books' || item.source === 'open_library') {
                detailsRes = await window.electronAPI.invoke('books-get-details', item.id);
            } else if (item.source === 'anilist') {
                detailsRes = await window.electronAPI.invoke('anilist-get-details', item.id, item.category || selectedCategory);
            }

            if (detailsRes && detailsRes.success) {
                setInspectedItem({
                    ...item,
                    ...detailsRes,
                    category: selectedCategory
                });
            } else {
                setInspectedItem({ ...item, category: selectedCategory });
            }
        } catch (err) {
            console.warn('Could not fetch extra details for inspection, using item preview', err);
            setInspectedItem({ ...item, category: selectedCategory });
        }
        setIsInspecting(true);
    };

    const categories: MediaCategory[] = ['Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga'];

    return (
        <div className="flex-1 w-full max-w-7xl mx-auto p-6 space-y-6 animate-fade-in">
            {/* Header banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-5">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                        Discover & Add Media
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        Search global libraries (TMDB, AniList, Google Books & Open Library) and inspect before adding.
                    </p>
                </div>

                {/* Provider switcher */}
                <div className="flex items-center gap-2 bg-[#1b1b1b] p-1 rounded-xl border border-gray-800 self-stretch sm:self-auto">
                    {(['TMDB', 'AniList', 'GoogleBooks'] as SearchProvider[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => handleProviderChange(p)}
                            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                provider === p
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {p === 'TMDB' ? '🎬 TMDB' : p === 'AniList' ? '🌸 AniList' : '📖 Google Books'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Category filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => handleCategoryChange(cat)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all shrink-0 border ${
                            selectedCategory === cat
                                ? 'bg-white/10 text-white border-blue-500/50 shadow-md shadow-blue-500/10'
                                : 'bg-[#181818] text-gray-400 border-gray-800 hover:text-white hover:bg-[#222]'
                        }`}
                    >
                        <CategoryIcon category={cat} className="w-4 h-4" />
                        <span>{cat}</span>
                    </button>
                ))}
            </div>

            {/* Search Input Box */}
            <form onSubmit={handleSearchSubmit} className="space-y-3">
                <div className="relative flex items-center">
                    <div className="absolute left-4 text-gray-500 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input
                        type="text"
                        placeholder={`Search ${selectedCategory} by title...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#1b1b1b] border border-gray-700/80 rounded-2xl pl-11 pr-28 py-3.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-lg"
                    />

                    <div className="absolute right-2.5 flex items-center gap-1.5">
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setResults([]); }}
                                className="text-gray-400 hover:text-white px-2 py-1 text-xs"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading || !searchQuery.trim()}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5"
                        >
                            {loading ? <span>Searching...</span> : <span>Search</span>}
                        </button>
                    </div>
                </div>

                {/* Advanced Search Toggle */}
                <div className="flex justify-between items-center text-xs px-1">
                    <button
                        type="button"
                        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                        className="text-gray-400 hover:text-blue-400 flex items-center gap-1.5 font-medium transition-colors"
                    >
                        <span>{isAdvancedOpen ? '▾' : '▸'}</span>
                        <span>Advanced Search Filters</span>
                        {(advancedFilters.year || advancedFilters.creator) && (
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                    </button>

                    {(advancedFilters.year || advancedFilters.creator) && (
                        <button
                            type="button"
                            onClick={() => {
                                setAdvancedFilters({ year: '', creator: '' });
                                if (searchQuery.trim()) {
                                    executeSearch(searchQuery, selectedCategory, provider, { year: '', creator: '' });
                                }
                            }}
                            className="text-gray-500 hover:text-red-400 text-xs"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>

                {/* Advanced Fields Drawer */}
                {isAdvancedOpen && (
                    <div className="p-4 bg-[#181818] border border-gray-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in shadow-inner">
                        <div className="space-y-1.5">
                            <label className="text-xs text-gray-400 font-medium">Release / Publication Year</label>
                            <input
                                type="text"
                                placeholder="e.g. 2024, 1999"
                                value={advancedFilters.year || ''}
                                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, year: e.target.value }))}
                                className="w-full bg-[#242424] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs text-gray-400 font-medium">
                                Creator ({selectedCategory === 'Books' || selectedCategory === 'Manga' ? 'Author' : 'Director / Studio'})
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Christopher Nolan, Brandon Sanderson, Kyoto Animation"
                                value={advancedFilters.creator || ''}
                                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, creator: e.target.value }))}
                                className="w-full bg-[#242424] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                )}
            </form>

            {/* Error Message */}
            {errorMsg && (
                <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-200 text-xs flex items-center justify-between">
                    <span>⚠️ {errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">✕</button>
                </div>
            )}

            {/* Loading Indicator */}
            {loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 pt-4">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className="bg-[#1a1a1a] border border-gray-800 rounded-xl aspect-2/3 animate-pulse" />
                    ))}
                </div>
            )}

            {/* Results Grid */}
            {!loading && results.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs text-gray-400">
                        Showing {results.length} results. Click any card to inspect full details and add to your library.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                        {results.map((r) => {
                            const inLibrary = existingItems.find(
                                i => (r.source && r.source_id && i.source === r.source && i.source_id === r.source_id) ||
                                     (i.title.toLowerCase().trim() === (r.title || '').toLowerCase().trim() && i.category === selectedCategory)
                            );

                            return (
                                <div
                                    key={`${r.source}_${r.id}`}
                                    onClick={() => handleInspect(r)}
                                    className="group relative bg-[#181818] border border-gray-800/80 hover:border-blue-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 flex flex-col"
                                >
                                    {/* Poster Aspect Box */}
                                    <div className="aspect-2/3 w-full bg-gray-900 relative overflow-hidden">
                                        {r.poster_path ? (
                                            <img
                                                src={r.poster_path}
                                                alt={r.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-1 p-2">
                                                <CategoryIcon category={selectedCategory} className="w-8 h-8" />
                                                <span className="text-[10px] text-center">No Image</span>
                                            </div>
                                        )}

                                        {/* Status Tag Overlay */}
                                        {inLibrary && (
                                            <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shadow">
                                                ✓ {inLibrary.status}
                                            </div>
                                        )}

                                        {r.rating && (
                                            <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-xs text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                ★ {r.rating}
                                            </div>
                                        )}

                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-blue-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-white/20 shadow-lg">
                                                🔍 Inspect Details
                                            </span>
                                        </div>
                                    </div>

                                    {/* Info Strip */}
                                    <div className="p-3 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-semibold text-xs sm:text-sm text-white line-clamp-1 group-hover:text-blue-400 transition-colors">
                                                {r.title}
                                            </h3>
                                            <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                                                {r.author || r.director || r.studio || r.genre || selectedCategory}
                                            </p>
                                        </div>

                                        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500 pt-1.5 border-t border-gray-800/60">
                                            <span>{r.year || 'Unknown'}</span>
                                            {r.page_count && <span>{r.page_count}p</span>}
                                            {r.runtime && <span>{r.runtime}m</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && results.length === 0 && searchQuery && (
                <div className="text-center py-20 text-gray-500 space-y-2">
                    <p className="text-base font-medium">No results found for "{searchQuery}"</p>
                    <p className="text-xs text-gray-600">Try adjusting your spelling or searching with fewer keywords.</p>
                </div>
            )}

            {!loading && results.length === 0 && !searchQuery && (
                <div className="text-center py-24 text-gray-600 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-[#1b1b1b] border border-gray-800 flex items-center justify-center mx-auto text-2xl">
                        🔍
                    </div>
                    <p className="text-sm font-medium text-gray-400">Discover media across global platforms</p>
                    <p className="text-xs text-gray-600 max-w-sm mx-auto">
                        Type a title above to search movies, anime, series, books, and manga with automated cover downloads.
                    </p>
                </div>
            )}

            {/* Detailed Inspection Modal */}
            <MediaInspectionModal
                isOpen={isInspecting}
                onClose={() => { setIsInspecting(false); setInspectedItem(null); }}
                item={inspectedItem}
                existingItems={existingItems}
                onAddToLibrary={onAddToLibrary}
            />
        </div>
    );
};

export default DiscoverView;
