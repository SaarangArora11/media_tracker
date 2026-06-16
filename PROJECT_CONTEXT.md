# Media Tracker Project Context

**Date**: January 2026
**Project**: Media Tracker (Electron/React Desktop App)
**Goal**: A localized, offline-first application to track media consumption (Movies, Series, Anime, Books, Games, Manga) with features like tracking dates, ratings, reviews, priority, and location.

---

## 🚀 Tech Stack

-   **Frontend**: React 18, TypeScript, TailwindCSS v4, Vite
-   **Backend**: Electron (Main Process), Better-SQLite3 (Local Database)
-   **Packaging**: Electron Builder (NSIS Installer)

---

## ✨ Features (V1 - V4.2)

1.  **CRUD Operations**: Add, Edit, Delete media items with fields like Status, Rating, Review, Dates.
2.  **Extended Metadata**: Genre, Tags, Author/Director, Priority, Location.
3.  **Media Types**: Movies, Series, Anime, Books, Games, Manga (custom icons).
4.  **Local Image Support**: Drag & Drop or paste image paths (stored in `AppData/covers`).
5.  **Smart Grouping**: Group library by Category, Priority, Location, or Genre.
6.  **Navigation**: Integrated top-bar tabs (Watching, To Consume, Consumed) and Unified Header.
7.  **Data Management**:
    *   **Import**: Bulk import from `.txt` files.
    *   **Backup/Restore**: Full `.zip` backup of database and images.
8.  **Adaptive UI**: Responsive layout, dark mode, tag filtering, and smart autocomplete.

---

## 📂 Database Schema (SQLite)

**Table**: `items`
-   `id` (INTEGER PK)
-   `title` (TEXT)
-   `category` (TEXT CHECK in 'Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga')
-   `status` (TEXT CHECK in 'Watching', 'To Consume', 'Consumed')
-   `priority` (TEXT Default 'Normal')
-   `location` (TEXT) - *Where consumed*
-   `date_finished`, `rating`, `review`, `image_path`
-   `genre`, `tags`
-   `author`, `director`, `writer`, `actors`, `studio`, `platform`
-   `created_at`

---

## 💻 Source Code Context

### 1. Main App Logic (`src/App.tsx`)
*Handles routing, state management, IPC calls, filtering, and layout.*
```tsx
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
    const [groupBy, setGroupBy] = useState<'None' | 'Category' | 'Priority' | 'Location' | 'Genre'>('None');
    const [filterTag, setFilterTag] = useState<string>('');
    const [importedTitles, setImportedTitles] = useState<string[]>([]);
    const [importFileData, setImportFileData] = useState<{ titleCount: number; path: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MediaItem | undefined>(undefined);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    useEffect(() => { loadItems(); }, []);

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
                                        className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 items-center">
                            <div className="flex gap-2 mr-4 border-r border-gray-700 pr-4">
                                <button onClick={async () => { if (confirm('Create Backup?')) { const res = await window.electronAPI.invoke('backup-create'); if(res.success) alert(`Saved to: ${res.path}`); }}} className="text-gray-400 hover:text-white text-xs uppercase font-bold tracking-wider">Backup</button>
                                <button onClick={async () => { if (confirm('Restore will OVERWRITE. Continue?')) { const res = await window.electronAPI.invoke('backup-restore'); if(res && !res.success) alert(res.message); }}} className="text-gray-400 hover:text-red-400 text-xs uppercase font-bold tracking-wider">Restore</button>
                            </div>
                            <button onClick={handleImportClick} className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">Import .txt</button>
                            <button onClick={() => { setEditingItem(undefined); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-blue-500/20">+ Add Entry</button>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-t border-gray-800 pt-3">
                        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                             <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-md outline-none focus:border-blue-500 w-48 text-sm"/>
                            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-md outline-none focus:border-blue-500 cursor-pointer text-sm">
                                <option value="">All Tags</option>
                                {uniqueTags.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-md outline-none focus:border-blue-500 cursor-pointer text-sm">
                                <option value="Newest">Newest First</option> <option value="Title">Title (A-Z)</option> <option value="Rating">Highest Rated</option> {activeTab === 'Consumed' && <option value="Finished">Date Finished</option>}
                            </select>
                            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="bg-[#121212] border border-gray-700 text-white px-3 py-1.5 rounded-md outline-none focus:border-blue-500 cursor-pointer text-sm">
                                <option value="None">No Grouping</option> <option value="Category">Category</option> <option value="Priority">Priority</option> <option value="Location">Location</option> <option value="Genre">Genre</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full p-6">
                <div className="space-y-8">
                    {Object.entries(groupedItems).map(([group, groupItems]) => (
                        <div key={group}>
                            {groupBy !== 'None' && <h2 className="text-xl font-bold text-gray-400 mb-4 border-b border-gray-800 pb-2">{group} <span className="text-sm font-normal ml-2 opacity-50">({groupItems.length})</span></h2>}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 Gap-6">
                                {groupItems.map(item => <MediaCard key={item.id} item={item} onEdit={(i) => { setEditingItem(i); setIsModalOpen(true); }} onDelete={handleDelete} />)}
                            </div>
                        </div>
                    ))}
                    {processedItems.length === 0 && <div className="text-center py-20 opacity-30"><p className="text-xl">No items found</p></div>}
                </div>
            </main>
            <AddEditModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(undefined); }} onSave={handleSave} item={editingItem} existingGenres={uniqueGenres} existingTags={uniqueTags} existingLocations={uniqueLocations} />
            <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} fileData={importFileData} onImport={async (category, status) => { const res = await window.electronAPI.invoke('bulk-add-items', { titles: importedTitles, category, status }); if (res.success) { alert(`Imported ${res.count} items!`); loadItems(); setIsImportModalOpen(false); setImportedTitles([]); setImportFileData(null); } }} />
        </div>
    );
}
export default App;
```

### 2. Database & IPC (`electron/database.cts`)
*Handles SQLite connection, migrations, and IPC handlers.*
```typescript
const Database = require('better-sqlite3');
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const currentVersion = 2; // Supports Location

const dbPath = path.join(app.getPath('userData'), 'media_tracker.db');
const db = new Database(dbPath);
const AdmZip = require('adm-zip');

// Init Schema with Migrations
const initSchema = () => {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'").get();
    if (!tableInfo) {
        db.exec(`CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga')), status TEXT NOT NULL CHECK(status IN ('Watching', 'To Consume', 'Consumed')), date_finished TEXT, rating INTEGER, review TEXT, image_path TEXT, genre TEXT, tags TEXT, author TEXT, director TEXT, writer TEXT, actors TEXT, studio TEXT, platform TEXT, priority TEXT DEFAULT 'Normal', location TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
        db.pragma(`user_version = ${currentVersion}`);
        return;
    }

    const version = db.pragma('user_version', { simple: true });
    if (version < 2) { // Migration V2: Location
        const columns = db.prepare("PRAGMA table_info(items)").all().map((c:any) => c.name);
        if (!columns.includes('location')) db.exec("ALTER TABLE items ADD COLUMN location TEXT");
        db.pragma('user_version = 2');
    }
    
    // Manga Migration Check (V3.1)
    const hasManga = tableInfo.sql.includes("'Manga'");
    if (!hasManga) {
         // (Migration logic for recreating table with new CHECK constraint - omitted for brevity but present in codebase)
    }
};
initSchema();

// Handlers
ipcMain.handle('get-items', () => db.prepare('SELECT * FROM items ORDER BY created_at DESC').all());
ipcMain.handle('add-item', (e:any, item:any) => {
    if (!item.priority) item.priority = 'Normal';
    const stmt = db.prepare(`INSERT INTO items (title, category, status, date_finished, rating, review, image_path, genre, tags, author, director, writer, actors, studio, platform, priority, location) VALUES (@title, @category, @status, @date_finished, @rating, @review, @image_path, @genre, @tags, @author, @director, @writer, @actors, @studio, @platform, @priority, @location)`);
    return stmt.run(item);
});
ipcMain.handle('update-item', (e:any, item:any) => {
    const stmt = db.prepare(`UPDATE items SET title=@title, category=@category, status=@status, date_finished=@date_finished, rating=@rating, review=@review, image_path=@image_path, genre=@genre, tags=@tags, author=@author, director=@director, writer=@writer, actors=@actors, studio=@studio, platform=@platform, priority=@priority, location=@location WHERE id=@id`);
    return stmt.run(item);
});
ipcMain.handle('delete-item', (e:any, id:any) => db.prepare('DELETE FROM items WHERE id = ?').run(id));
ipcMain.handle('backup-create', async () => { /* ... Zip creation logic ... */ });
ipcMain.handle('backup-restore', async () => { /* ... Zip extraction & relaunch logic ... */ });
```

### 3. Types (`src/types.ts`)
```typescript
export interface MediaItem {
    id?: number;
    title: string;
    category: 'Movies' | 'Series' | 'Anime' | 'Books' | 'Games' | 'Manga';
    status: 'Watching' | 'To Consume' | 'Consumed';
    date_finished?: string;
    rating?: number;
    review?: string;
    image_path?: string;
    genre?: string;
    tags?: string;
    priority?: 'High' | 'Normal' | 'Low';
    location?: string;
    // Specific fields
    author?: string;
    director?: string;
    writer?: string;
    actors?: string;
    studio?: string;
    platform?: string;
    created_at?: string;
}
```

### 4. Components

**MediaCard**: Displays the poster/icon, title, status, rating, priority border, and delete button.
**CategoryIcon**: SVG icons for Movies, Series, Anime, Books, Games, Manga.
**AddEditModal**: Dynamic form that adapts fields based on Category (e.g., shows 'Author' for Books, 'Director' for Movies). Features custom Tag Autocomplete and Image Paste support.
**ImportModal**: Simple modal to assign Category/Status to bulk text imports.

---

## 🛠 How to Build

1.  **Install**: `npm install`
2.  **Dev**: `npm run dev`
3.  **Build**: `npm run make` (Generates `.exe` installer in `dist-exe/`)
