import { useState, useEffect, useMemo } from 'react';
import MediaCard from './components/MediaCard';
import AddEditModal from './components/AddEditModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import MetadataSearchModal from './components/MetadataSearchModal';
import DiscoverView from './components/DiscoverView';
import StatisticsView from './components/StatisticsView';
import DeduplicationModal from './components/DeduplicationModal';
import type { MediaItem, ActiveTabType, ActiveViewType, DuplicatePair } from './types';

function App() {
    const [items, setItems] = useState<MediaItem[]>([]);
    const [activeView, setActiveView] = useState<ActiveViewType>('Library');
    const [activeTab, setActiveTab] = useState<ActiveTabType>('Consuming');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'Newest' | 'Title' | 'Rating' | 'Finished'>('Newest');
    const [groupBy, setGroupBy] = useState<'None' | 'Category' | 'Priority' | 'Location' | 'Genre'>('None');
    const [filterTag, setFilterTag] = useState<string>('');
    const [importedTitles, setImportedTitles] = useState<string[]>([]);
    const [importFileData, setImportFileData] = useState<{ titleCount: number; path: string } | null>(null);

    // Duplicate detection state
    const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
    const [isDeduplicationOpen, setIsDeduplicationOpen] = useState(false);

    // Modals UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMetadataSearchOpen, setIsMetadataSearchOpen] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [searchCategory, setSearchCategory] = useState<string>('Movies');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [editingItem, setEditingItem] = useState<MediaItem | undefined>(undefined);

    // Bulk Import State
    const [importQueue, setImportQueue] = useState<string[]>([]);
    const [importCategory, setImportCategory] = useState<string>('Movies');
    const [importStatus, setImportStatus] = useState<string>('To Consume');
    const [isProcessingImport, setIsProcessingImport] = useState(false);

    useEffect(() => {
        loadItems();
    }, []);

    // Close add menu on outside click
    useEffect(() => {
        const h = () => setShowAddMenu(false);
        document.addEventListener('click', h);
        return () => document.removeEventListener('click', h);
    }, []);

    const loadItems = async () => {
        try {
            const data = await window.electronAPI.invoke('get-items');
            setItems(data || []);

            // Check duplicates in background
            const dups = await window.electronAPI.invoke('check-duplicates');
            setDuplicates(dups || []);
        } catch (err) {
            console.error('Failed to load items/duplicates:', err);
        }
    };

    const handleSave = async (item: MediaItem) => {
        try {
            if (item.id) await window.electronAPI.invoke('update-item', item);
            else await window.electronAPI.invoke('add-item', item);
            loadItems();
            setIsModalOpen(false);
        } catch (err: any) {
            console.error('Failed to save item:', err);
            const errCode = err?.code || 'DB_SAVE_ERROR';
            const errMsg = err?.message || 'Failed to save item to database.';
            alert(`Failed to Save Entry\n\nError Code: ${errCode}\nError Message: ${errMsg}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm('Are you sure you want to delete this item?')) {
            await window.electronAPI.invoke('delete-item', id);
            loadItems();
            setEditingItem(undefined);
            setIsModalOpen(false);
        }
    };

    const handleImportClick = async () => {
        const res = await window.electronAPI.invoke('import-from-text');
        if (res.success && res.titles) {
            setImportedTitles(res.titles);
            setImportFileData({ titleCount: res.titles.length, path: 'Selected File' });
            setIsImportModalOpen(true);
        } else if (res.message && res.message !== 'Selection cancelled') alert(res.message);
    };

    // Bulk Import handler
    const handleBulkImportStart = async (category: string, status: string, method: 'Manual' | 'TMDB') => {
        if (method === 'Manual') {
            const res = await window.electronAPI.invoke('bulk-add-items', { titles: importedTitles, category, status });
            if (res.success) {
                alert(`Imported ${res.count} items!`);
                loadItems();
                setIsImportModalOpen(false);
                setImportedTitles([]);
                setImportFileData(null);
            }
        } else {
            // Start Online Metadata Loop
            setImportCategory(category);
            setImportStatus(status);
            setImportQueue([...importedTitles]);
            setIsImportModalOpen(false);
            setIsProcessingImport(true);
            setSearchQuery(importedTitles[0]);
            setSearchCategory(category);
            setIsMetadataSearchOpen(true);
        }
    };

    const handleMetadataSelect = async (item: any) => {
        let derivedCategory: any = item.category || 'Movies';
        if (item.media_type === 'tv') derivedCategory = 'Series';
        if (item.media_type === 'movie') derivedCategory = 'Movies';
        if (item.media_type === 'Books') derivedCategory = 'Books';
        if (item.media_type === 'Anime') derivedCategory = 'Anime';
        if (item.media_type === 'Manga') derivedCategory = 'Manga';

        if (isProcessingImport) {
            const newItem: MediaItem = {
                title: item.title,
                category: (importCategory || derivedCategory) as any,
                status: (importStatus || 'To Consume') as any,
                genre: item.genre,
                image_path: item.poster,
                author: item.author,
                director: item.director,
                studio: item.studio,
                priority: 'Normal',
                runtime: item.runtime || null,
                page_count: item.page_count || null,
                source: item.source || null,
                source_id: item.source_id ? String(item.source_id) : null
            };
            try {
                await window.electronAPI.invoke('add-item', newItem);
            } catch (err: any) {
                console.error('Bulk metadata item save error:', err);
                alert(`Failed to Add Item "${item.title}"`);
            }

            const nextQueue = importQueue.slice(1);
            if (nextQueue.length > 0) {
                setImportQueue(nextQueue);
                setSearchQuery(nextQueue[0]);
            } else {
                setIsProcessingImport(false);
                setIsMetadataSearchOpen(false);
                loadItems();
                alert('Bulk Import Completed!');
                setImportedTitles([]);
                setImportFileData(null);
            }
        } else {
            // Single Item Add or Autofill
            setEditingItem(prev => ({
                ...(prev || {}),
                title: item.title,
                category: derivedCategory,
                status: prev?.status || 'To Consume',
                genre: item.genre || prev?.genre,
                author: item.author || prev?.author,
                director: item.director || prev?.director,
                studio: item.studio || prev?.studio,
                image_path: item.poster || prev?.image_path,
                review: item.overview || prev?.review,
                runtime: item.runtime ?? prev?.runtime,
                page_count: item.page_count ?? prev?.page_count,
                source: item.source || prev?.source,
                source_id: item.source_id ? String(item.source_id) : prev?.source_id
            } as any));
            setIsMetadataSearchOpen(false);
            setIsModalOpen(true);
        }
    };

    const handleSearchSkip = () => {
        if (isProcessingImport) {
            const nextQueue = importQueue.slice(1);
            if (nextQueue.length > 0) {
                setImportQueue(nextQueue);
                setSearchQuery(nextQueue[0]);
            } else {
                setIsProcessingImport(false);
                setIsMetadataSearchOpen(false);
                loadItems();
                alert('Bulk Import Completed (with Skips)!');
                setImportedTitles([]);
                setImportFileData(null);
            }
        }
    };

    const handleOpenAutofill = (title: string, category: string) => {
        setSearchQuery(title);
        setSearchCategory(category);
        setIsModalOpen(false);
        setIsMetadataSearchOpen(true);
    };

    const { uniqueGenres, uniqueTags, uniqueLocations } = useMemo(() => {
        const genres = new Set<string>();
        const tags = new Set<string>();
        const locations = new Set<string>();
        items.forEach(i => {
            if (i.genre) i.genre.split(',').forEach(g => genres.add(g.trim()));
            if (i.tags) i.tags.split(',').forEach(t => tags.add(t.trim()));
            if (i.location) locations.add(i.location.trim());
        });
        return {
            uniqueGenres: Array.from(genres).sort(),
            uniqueTags: Array.from(tags).sort(),
            uniqueLocations: Array.from(locations).sort()
        };
    }, [items]);

    const processedItems = useMemo(() => {
        let filtered = items.filter(item =>
            item.status === activeTab &&
            (item.title.toLowerCase().includes(search.toLowerCase()) ||
                item.category.toLowerCase().includes(search.toLowerCase()))
        );
        if (filterTag) {
            filtered = filtered.filter(item => item.tags?.toLowerCase().includes(filterTag.toLowerCase()));
        }
        return filtered.sort((a, b) => {
            if (sortBy === 'Title') return a.title.localeCompare(b.title);
            if (sortBy === 'Rating') return (b.rating || 0) - (a.rating || 0);
            if (sortBy === 'Finished') return (new Date(b.date_finished || 0).getTime()) - (new Date(a.date_finished || 0).getTime());
            return (new Date(b.created_at || '').getTime()) - (new Date(a.created_at || '').getTime());
        });
    }, [items, activeTab, search, sortBy, filterTag]);

    const groupedItems = useMemo(() => {
        if (groupBy === 'None') return { 'All': processedItems };
        const groups: Record<string, MediaItem[]> = {};
        processedItems.forEach(item => {
            let keys: string[] = [];
            if (groupBy === 'Category') keys = [item.category];
            else if (groupBy === 'Priority') keys = [item.priority || 'Normal'];
            else if (groupBy === 'Location') keys = [item.location || 'Unknown'];
            else if (groupBy === 'Genre') keys = item.genre ? item.genre.split(',').map(g => g.trim()) : ['Uncategorized'];

            keys.forEach(key => {
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            });
        });
        return groups;
    }, [processedItems, groupBy]);

    return (
        <div className="min-h-screen bg-[#121212] text-white font-sans flex flex-col">
            {/* Header */}
            <header className="bg-[#1e1e1e] border-b border-gray-800 sticky top-0 z-20 shadow-lg">
                <div className="w-full px-6 py-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                                    Media Tracker
                                </h1>
                                <p className="text-gray-400 text-[11px] mt-0.5 uppercase tracking-wider font-medium">Track your year</p>
                            </div>

                            {/* View Switcher Tabs */}
                            <div className="hidden sm:flex bg-[#121212] p-1 rounded-xl border border-gray-800 ml-4">
                                <button
                                    onClick={() => setActiveView('Library')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                        activeView === 'Library'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <span>📚</span> Library
                                </button>
                                <button
                                    onClick={() => setActiveView('Discover')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                        activeView === 'Discover'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <span>🔍</span> Discover
                                </button>
                                <button
                                    onClick={() => setActiveView('Statistics')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                        activeView === 'Statistics'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <span>📊</span> Statistics
                                </button>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex gap-3 items-center relative">
                            <div className="flex gap-2 mr-3 border-r border-gray-700 pr-3">
                                <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
                                    title="Settings & API Keys"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                                <button
                                    onClick={async () => {
                                        if (confirm('Create Backup?')) {
                                            const res = await window.electronAPI.invoke('backup-create');
                                            if (res.success) alert(`Saved to: ${res.path}`);
                                        }
                                    }}
                                    className="text-gray-400 hover:text-white text-xs uppercase font-bold tracking-wider"
                                >
                                    Backup
                                </button>
                                <button
                                    onClick={async () => {
                                        if (confirm('Restore will OVERWRITE. Continue?')) {
                                            const res = await window.electronAPI.invoke('backup-restore');
                                            if (res && !res.success) alert(res.message);
                                        }
                                    }}
                                    className="text-gray-400 hover:text-red-400 text-xs uppercase font-bold tracking-wider"
                                >
                                    Restore
                                </button>
                            </div>

                            <button
                                onClick={handleImportClick}
                                className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-3.5 py-1.5 rounded-lg transition-colors text-xs"
                            >
                                Import .txt
                            </button>

                            {/* Add Entry Button with Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu); }}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors shadow-lg hover:shadow-blue-500/20 text-xs flex items-center gap-1.5"
                                >
                                    <span>+ Add Entry</span>
                                    <span className="text-[10px]">▾</span>
                                </button>
                                {showAddMenu && (
                                    <div className="absolute right-0 mt-2 w-52 bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                                        <button
                                            onClick={() => { setEditingItem(undefined); setIsModalOpen(true); setShowAddMenu(false); }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-xs text-white flex items-center gap-2"
                                        >
                                            <span>✍️</span> Manual Entry
                                        </button>
                                        <button
                                            onClick={() => { setActiveView('Discover'); setShowAddMenu(false); }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-xs text-white flex items-center justify-between group"
                                        >
                                            <span className="flex items-center gap-2"><span>🔍</span> Discover & Search</span>
                                            <span className="bg-blue-600/30 text-blue-400 text-[10px] px-1.5 py-0.5 rounded">NEW</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Secondary Row for Mobile View Switcher */}
                    <div className="sm:hidden flex bg-[#121212] p-1 rounded-xl border border-gray-800">
                        {(['Library', 'Discover', 'Statistics'] as ActiveViewType[]).map((v) => (
                            <button
                                key={v}
                                onClick={() => setActiveView(v)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeView === v ? 'bg-blue-600 text-white' : 'text-gray-400'
                                }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>

                    {/* Library Controls Bar (Only when viewing Library) */}
                    {activeView === 'Library' && (
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-t border-gray-800 pt-3">
                            {/* Subtabs: Consuming, To Consume, Consumed */}
                            <div className="flex bg-[#121212] p-1 rounded-xl border border-gray-800">
                                {(['Consuming', 'To Consume', 'Consumed'] as ActiveTabType[]).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-1 rounded-lg text-xs font-semibold transition-all ${
                                            activeTab === tab
                                                ? 'bg-blue-600 text-white shadow'
                                                : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Filters & Sorting */}
                            <div className="flex gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 items-center">
                                <input
                                    placeholder="Search library..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 w-44 text-xs"
                                />

                                <select
                                    value={filterTag}
                                    onChange={(e) => setFilterTag(e.target.value)}
                                    className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 cursor-pointer text-xs"
                                >
                                    <option value="">All Tags</option>
                                    {uniqueTags.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>

                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 cursor-pointer text-xs"
                                >
                                    <option value="Newest">Newest First</option>
                                    <option value="Title">Title (A-Z)</option>
                                    <option value="Rating">Highest Rated</option>
                                    {activeTab === 'Consumed' && <option value="Finished">Date Finished</option>}
                                </select>

                                <select
                                    value={groupBy}
                                    onChange={(e) => setGroupBy(e.target.value as any)}
                                    className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 cursor-pointer text-xs"
                                >
                                    <option value="None">No Grouping</option>
                                    <option value="Category">Group by Category</option>
                                    <option value="Priority">Group by Priority</option>
                                    <option value="Location">Group by Location</option>
                                    <option value="Genre">Group by Genre</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Deduplication Alert Banner */}
            {duplicates.length > 0 && (
                <div className="bg-amber-950/40 border-b border-amber-800/60 px-6 py-2.5 flex items-center justify-between text-xs text-amber-200 shadow-inner">
                    <div className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span>
                            <strong>{duplicates.length}</strong> potential {duplicates.length === 1 ? 'duplicate entry' : 'duplicate entries'} detected across your library.
                        </span>
                    </div>
                    <button
                        onClick={() => setIsDeduplicationOpen(true)}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 px-3 py-1 rounded-lg font-semibold transition-colors"
                    >
                        Review Duplicates
                    </button>
                </div>
            )}

            {/* Active View Container */}
            <main className="flex-1 w-full flex flex-col">
                {activeView === 'Library' && (
                    <div className="flex-1 w-full p-6 space-y-8 animate-fade-in">
                        {Object.entries(groupedItems).map(([group, groupItems]) => (
                            <div key={group}>
                                {groupBy !== 'None' && (
                                    <h2 className="text-lg font-bold text-gray-300 mb-4 border-b border-gray-800 pb-2 flex items-center gap-2">
                                        <span>{group}</span>
                                        <span className="text-xs font-normal text-gray-500">({groupItems.length})</span>
                                    </h2>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                    {groupItems.map(item => (
                                        <MediaCard
                                            key={item.id}
                                            item={item}
                                            onEdit={(i) => { setEditingItem(i); setIsModalOpen(true); }}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}

                        {processedItems.length === 0 && (
                            <div className="text-center py-24 opacity-30 space-y-2">
                                <p className="text-xl font-medium">No items in {activeTab}</p>
                                <p className="text-xs">Click "+ Add Entry" or switch to "Discover" to add media.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeView === 'Discover' && (
                    <DiscoverView
                        existingItems={items}
                        onAddToLibrary={async (newItem) => {
                            await handleSave(newItem);
                        }}
                    />
                )}

                {activeView === 'Statistics' && (
                    <StatisticsView
                        items={items}
                        onRefresh={loadItems}
                    />
                )}
            </main>

            {/* Modals */}
            <AddEditModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingItem(undefined); }}
                onSave={handleSave}
                item={editingItem}
                existingGenres={uniqueGenres}
                existingTags={uniqueTags}
                existingLocations={uniqueLocations}
                onSearchOnline={handleOpenAutofill}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                fileData={importFileData}
                onImport={handleBulkImportStart}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            <MetadataSearchModal
                isOpen={isMetadataSearchOpen}
                onClose={() => { setIsMetadataSearchOpen(false); setIsProcessingImport(false); }}
                onSelect={handleMetadataSelect}
                onSkip={isProcessingImport ? handleSearchSkip : undefined}
                initialQuery={searchQuery}
                category={searchCategory}
            />

            <DeduplicationModal
                isOpen={isDeduplicationOpen}
                onClose={() => setIsDeduplicationOpen(false)}
                duplicates={duplicates}
                onRefresh={loadItems}
            />
        </div>
    );
}

export default App;
