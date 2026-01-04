import { useState, useEffect, useMemo } from 'react';
import MediaCard from './components/MediaCard';
import AddEditModal from './components/AddEditModal';
import ImportModal from './components/ImportModal';
import type { MediaItem } from './types';

function App() {
    const [items, setItems] = useState<MediaItem[]>([]);
    const [activeTab, setActiveTab] = useState<'Watching' | 'To Consume' | 'Consumed'>('Watching');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'Newest' | 'Title' | 'Rating' | 'Finished'>('Newest');
    const [groupBy, setGroupBy] = useState<'None' | 'Category' | 'Priority' | 'Location'>('None');
    const [filterTag, setFilterTag] = useState<string>('');

    // Import State
    const [importedTitles, setImportedTitles] = useState<string[]>([]);
    const [importFileData, setImportFileData] = useState<{ titleCount: number; path: string } | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MediaItem | undefined>(undefined);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        const data = await window.electronAPI.invoke('get-items');
        setItems(data);
    };

    const handleSave = async (item: MediaItem) => {
        if (item.id) {
            await window.electronAPI.invoke('update-item', item);
        } else {
            await window.electronAPI.invoke('add-item', item);
        }
        loadItems();
        setIsModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if (confirm('Are you sure you want to delete this item?')) {
            await window.electronAPI.invoke('delete-item', id);
            loadItems();
            setEditingItem(undefined);
            setIsModalOpen(false); // Close modal if open on deleted item
        }
    };

    const handleImportClick = async () => {
        const res = await window.electronAPI.invoke('import-from-text');
        if (res.success && res.titles) {
            setImportedTitles(res.titles);
            setImportFileData({ titleCount: res.titles.length, path: 'Selected File' });
            setIsImportModalOpen(true);
        } else if (res.message && res.message !== 'Selection cancelled') {
            alert(res.message);
        }
    };

    // Derived Data for Autocomplete & Filters
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

    // Filtering & Sorting
    const processedItems = useMemo(() => {
        let filtered = items.filter(item =>
            item.status === activeTab &&
            (item.title.toLowerCase().includes(search.toLowerCase()) ||
                item.category.toLowerCase().includes(search.toLowerCase()))
        );

        if (filterTag) {
            filtered = filtered.filter(item =>
                item.tags?.toLowerCase().includes(filterTag.toLowerCase())
            );
        }

        return filtered.sort((a, b) => {
            if (sortBy === 'Title') return a.title.localeCompare(b.title);
            if (sortBy === 'Rating') return (b.rating || 0) - (a.rating || 0);
            if (sortBy === 'Finished') return (new Date(b.date_finished || 0).getTime()) - (new Date(a.date_finished || 0).getTime());
            // Default Newest
            return (new Date(b.created_at || '').getTime()) - (new Date(a.created_at || '').getTime());
        });
    }, [items, activeTab, search, sortBy, filterTag]);

    // Grouping
    const groupedItems = useMemo(() => {
        if (groupBy === 'None') return { 'All': processedItems };

        const groups: Record<string, MediaItem[]> = {};
        processedItems.forEach(item => {
            let key = '';
            if (groupBy === 'Category') key = item.category;
            else if (groupBy === 'Priority') key = item.priority || 'Normal';
            else if (groupBy === 'Location') key = item.location || 'Unknown';

            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [processedItems, groupBy]);

    return (
        <div className="min-h-screen bg-[#121212] text-white font-sans flex flex-col">
            {/* Header */}
            <header className="bg-[#1e1e1e] border-b border-gray-800 p-4 sticky top-0 z-10 shadow-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            Media Tracker
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Track your year in consumption</p>
                    </div>
                    <div className="flex gap-3 items-center">
                        {/* Backup Controls */}
                        <div className="flex gap-2 mr-4 border-r border-gray-700 pr-4">
                            <button
                                onClick={async () => {
                                    if (confirm('Create a full backup of your library?')) {
                                        const res = await window.electronAPI.invoke('backup-create');
                                        if (res.success) alert(`Backup saved to: ${res.path}`);
                                        else if (res.message) alert(res.message);
                                    }
                                }}
                                className="text-gray-400 hover:text-white text-xs uppercase font-bold tracking-wider"
                            >
                                Backup
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirm('WARNING: Restore will OVERWRITE your current library and restart the app. Continue?')) {
                                        const res = await window.electronAPI.invoke('backup-restore');
                                        if (res && !res.success && res.message) alert(res.message);
                                    }
                                }}
                                className="text-gray-400 hover:text-red-400 text-xs uppercase font-bold tracking-wider"
                            >
                                Restore
                            </button>
                        </div>

                        <button
                            onClick={handleImportClick}
                            className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                            Import .txt
                        </button>
                        <button
                            onClick={() => { setEditingItem(undefined); setIsModalOpen(true); }}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-blue-500/20"
                        >
                            + Add Entry
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex gap-6">

                {/* Sidebar / Filters (Left) */}
                {/* We can put the Tabs here or keep them top. Let's keep tabs top but add Tag Sidebar. */}

                <div className="flex-1">
                    {/* Tabs & Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                        <div className="flex bg-[#1e1e1e] p-1 rounded-lg border border-gray-800">
                            {['Watching', 'To Consume', 'Consumed'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <input
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-[#1e1e1e] border border-gray-700 text-white px-4 py-2 rounded-lg outline-none focus:border-blue-500 w-64"
                            />

                            {/* Tag Filter Dropdown */}
                            <select
                                value={filterTag}
                                onChange={(e) => setFilterTag(e.target.value)}
                                className="bg-[#1e1e1e] border border-gray-700 text-white px-4 py-2 rounded-lg outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="">All Tags</option>
                                {uniqueTags.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>

                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-[#1e1e1e] border border-gray-700 text-white px-4 py-2 rounded-lg outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="Newest">Newest First</option>
                                <option value="Title">Title (A-Z)</option>
                                <option value="Rating">Highest Rated</option>
                                {activeTab === 'Consumed' && <option value="Finished">Date Finished</option>}
                            </select>

                            <select
                                value={groupBy}
                                onChange={(e) => setGroupBy(e.target.value as any)}
                                className="bg-[#1e1e1e] border border-gray-700 text-white px-4 py-2 rounded-lg outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="None">No Grouping</option>
                                <option value="Category">Group by Category</option>
                                <option value="Priority">Group by Priority</option>
                                <option value="Location">Group by Location</option>
                            </select>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="space-y-8">
                        {Object.entries(groupedItems).map(([group, groupItems]) => (
                            <div key={group}>
                                {groupBy !== 'None' && (
                                    <h2 className="text-xl font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2">
                                        {group} <span className="text-sm font-normal ml-2 opacity-50">({groupItems.length})</span>
                                    </h2>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
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
                onImport={async (category, status) => {
                    const res = await window.electronAPI.invoke('bulk-add-items', {
                        titles: importedTitles,
                        category,
                        status
                    });
                    if (res.success) {
                        alert(`Imported ${res.count} items!`);
                        loadItems();
                        setIsImportModalOpen(false);
                        setImportedTitles([]);
                        setImportFileData(null);
                    }
                }}
            />
        </div>
    );
}

export default App;
