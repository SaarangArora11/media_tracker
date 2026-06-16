
import { useState, useEffect, useMemo } from 'react';
import MediaCard from './components/MediaCard';
import AddEditModal from './components/AddEditModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import TMDBSearchModal from './components/TMDBSearchModal';
import type { MediaItem } from './types';

function App() {
    const [items, setItems] = useState<MediaItem[]>([]);
    const [activeTab, setActiveTab] = useState<'Watching' | 'To Consume' | 'Consumed'>('Watching');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'Newest' | 'Title' | 'Rating' | 'Finished'>('Newest');
    const [groupBy, setGroupBy] = useState<'None' | 'Category' | 'Priority' | 'Location' | 'Genre'>('None');
    const [filterTag, setFilterTag] = useState<string>('');
    const [importedTitles, setImportedTitles] = useState<string[]>([]);
    const [importFileData, setImportFileData] = useState<{ titleCount: number; path: string } | null>(null);

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isTMDBSearchOpen, setIsTMDBSearchOpen] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);

    const [editingItem, setEditingItem] = useState<MediaItem | undefined>(undefined);

    // Bulk Import State
    const [importQueue, setImportQueue] = useState<string[]>([]);
    const [importCategory, setImportCategory] = useState<string>('Movies');
    const [importStatus, setImportStatus] = useState<string>('To Consume');
    const [isProcessingImport, setIsProcessingImport] = useState(false);
    const [importSearchQuery, setImportSearchQuery] = useState('');

    useEffect(() => { loadItems(); }, []);

    // Close menu on click outside
    useEffect(() => {
        const h = () => setShowAddMenu(false);
        document.addEventListener('click', h);
        return () => document.removeEventListener('click', h);
    }, []);

    const loadItems = async () => {
        const data = await window.electronAPI.invoke('get-items');
        setItems(data);
    };

    const handleSave = async (item: MediaItem) => {
        if (item.id) await window.electronAPI.invoke('update-item', item);
        else await window.electronAPI.invoke('add-item', item);
        loadItems();
        setIsModalOpen(false);
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

    // Triggered when user selects "Manual" or "Via TMDB" in Import Modal
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
            // Start TMDB Loop
            setImportCategory(category);
            setImportStatus(status);
            setImportQueue([...importedTitles]);
            setIsImportModalOpen(false);
            setIsProcessingImport(true);
            setImportSearchQuery(importedTitles[0]); // Start first
            setIsTMDBSearchOpen(true);
        }
    };

    const handleTMDBSelect = (item: any) => {
        // Map TMDB media_type to App Category
        let derivedCategory: any = 'Movies';
        if (item.media_type === 'tv') derivedCategory = 'Series';
        if (item.media_type === 'movie') derivedCategory = 'Movies';

        // If in bulk import, prioritize the import category, but maybe respecting the item is better?
        // Usually bulk import is into a specific list. 
        // If I am importing "Series", I want them to be Series.
        // But if I find a Movie in a Series import? 
        // Let's stick to importCategory if processing import, but use derived for Single Add.

        if (isProcessingImport) {
            // Save current item from queue
            const newItem: MediaItem = {
                title: item.title,
                category: importCategory as any, // Respect the Bulk Import target
                status: importStatus as any,
                genre: item.genre,
                image_path: item.poster,
                director: item.director,
                priority: 'Normal'
            };
            window.electronAPI.invoke('add-item', newItem); // Async but don't wait

            // Move to next
            const nextQueue = importQueue.slice(1);
            if (nextQueue.length > 0) {
                setImportQueue(nextQueue);
                setImportSearchQuery(nextQueue[0]);
                // Keep modal open, just update query
            } else {
                // Done
                setIsProcessingImport(false);
                setIsTMDBSearchOpen(false);
                loadItems();
                alert('Bulk Import Completed!');
                setImportedTitles([]);
                setImportFileData(null);
            }
        } else {
            // Single Item Add
            setEditingItem({
                title: item.title,
                category: derivedCategory, // Use derived category
                status: 'Watching',
                genre: item.genre,
                image_path: item.poster,
                director: item.director
            } as any);
            setIsTMDBSearchOpen(false);
            setIsModalOpen(true);
        }
    };

    const handleTMDBSkip = () => {
        if (isProcessingImport) {
            // Move to next without adding
            const nextQueue = importQueue.slice(1);
            if (nextQueue.length > 0) {
                setImportQueue(nextQueue);
                setImportSearchQuery(nextQueue[0]);
            } else {
                // Done
                setIsProcessingImport(false);
                setIsTMDBSearchOpen(false);
                loadItems();
                alert('Bulk Import Completed (with Skips)!');
                setImportedTitles([]);
                setImportFileData(null);
            }
        }
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
            <header className="bg-[#1e1e1e] border-b border-gray-800 sticky top-0 z-20 shadow-lg">
                <div className="w-full px-6 py-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Media Tracker</h1>
                                <p className="text-gray-400 text-xs mt-0.5 uppercase tracking-wider">Track your year</p>
                            </div>
                            <div className="hidden md:flex bg-[#121212] p-1 rounded-lg border border-gray-800 ml-8">
                                {['Watching', 'To Consume', 'Consumed'].map((tab) => (
                                    <button key={tab} onClick={() => setActiveTab(tab as any)}
                                        className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'} `}>
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 items-center relative">
                            <div className="flex gap-2 mr-4 border-r border-gray-700 pr-4">
                                <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-white" title="Settings">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                                <button onClick={async () => { if (confirm('Create Backup?')) { const res = await window.electronAPI.invoke('backup-create'); if (res.success) alert(`Saved to: ${res.path} `); } }} className="text-gray-400 hover:text-white text-xs uppercase font-bold tracking-wider">Backup</button>
                                <button onClick={async () => { if (confirm('Restore will OVERWRITE. Continue?')) { const res = await window.electronAPI.invoke('backup-restore'); if (res && !res.success) alert(res.message); } }} className="text-gray-400 hover:text-red-400 text-xs uppercase font-bold tracking-wider">Restore</button>
                            </div>
                            <button onClick={handleImportClick} className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">Import .txt</button>

                            <div className="relative">
                                <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu); }} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-blue-500/20 flex items-center gap-2">
                                    + Add Entry
                                </button>
                                {showAddMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
                                        <button onClick={() => { setEditingItem(undefined); setIsModalOpen(true); setShowAddMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm">Manual</button>
                                        <button onClick={() => { setIsTMDBSearchOpen(true); setShowAddMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm flex justify-between items-center group">
                                            Via TMDB <span className="bg-blue-600/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded group-hover:bg-blue-600 group-hover:text-white transition-colors">NEW</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Mobile Tabs (if needed) & Filters Row */}
                    <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-t border-gray-800 pt-3">
                        {/* Mobile Tabs Fallback */}
                        <div className="md:hidden w-full flex bg-[#121212] p-1 rounded-lg border border-gray-800">
                            {['Watching', 'To Consume', 'Consumed'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400'} `}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Filters */}
                        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                            <input
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-md outline-none focus:border-blue-500 w-48 text-sm"
                            />

                            <select
                                value={filterTag}
                                onChange={(e) => setFilterTag(e.target.value)}
                                className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-md outline-none focus:border-blue-500 cursor-pointer text-sm"
                            >
                                <option value="">All Tags</option>
                                {uniqueTags.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>

                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-md outline-none focus:border-blue-500 cursor-pointer text-sm"
                            >
                                <option value="Newest">Newest First</option>
                                <option value="Title">Title (A-Z)</option>
                                <option value="Rating">Highest Rated</option>
                                {activeTab === 'Consumed' && <option value="Finished">Date Finished</option>}
                            </select>

                            <select
                                value={groupBy}
                                onChange={(e) => setGroupBy(e.target.value as any)}
                                className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-md outline-none focus:border-blue-500 cursor-pointer text-sm"
                            >
                                <option value="None">No Grouping</option>
                                <option value="Category">Group by Category</option>
                                <option value="Priority">Group by Priority</option>
                                <option value="Location">Group by Location</option>
                                <option value="Genre">Group by Genre</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full p-6">
                <div className="space-y-8">
                    {Object.entries(groupedItems).map(([group, groupItems]) => (
                        <div key={group}>
                            {groupBy !== 'None' && (
                                <h2 className="text-xl font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2">
                                    {group} <span className="text-sm font-normal ml-2 opacity-50">({groupItems.length})</span>
                                </h2>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 Gap-6">
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
                        <div className="text-center py-20 opacity-30">
                            <p className="text-xl">No items found</p>
                        </div>
                    )}
                </div>
            </main>

            <AddEditModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingItem(undefined); }}
                onSave={handleSave}
                item={editingItem}
                existingGenres={uniqueGenres}
                existingTags={uniqueTags}
                existingLocations={uniqueLocations}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                fileData={importFileData}
                onImport={handleBulkImportStart}
            />
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <TMDBSearchModal isOpen={isTMDBSearchOpen} onClose={() => { setIsTMDBSearchOpen(false); setIsProcessingImport(false); }} onSelect={handleTMDBSelect} onSkip={isProcessingImport ? handleTMDBSkip : undefined} initialQuery={isProcessingImport ? importSearchQuery : undefined} category={isProcessingImport ? importCategory : undefined} />
        </div>
    );
}

export default App;
