"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Database = require('better-sqlite3');
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
// Store DB in user data to persist across updates/relocations
const dbPath = path.join(app.getPath('userData'), 'media_tracker.db');
console.log('Database path:', dbPath);
const db = new Database(dbPath);
// Initialize DB Schema
// We need to handle the migration for 'Manga' support which requires updating the CHECK constraint.
// SQLite doesn't support ALTER COLUMN for CHECK constraints, so we must recreate the table if needed.
const tmdb = require('./tmdb.cjs');
const books = require('./books.cjs');
const anilist = require('./anilist.cjs');
const initSchema = () => {
    // Check if 'settings' table exists
    const settingsTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='settings'").get();
    if (!settingsTable) {
        db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)");
        console.log("Created 'settings' table.");
    }
    // Robust Schema Check: Read the actual CREATE statement
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'").get();
    // If table doesn't exist, create it fresh (V3)
    if (!tableInfo) {
        console.log("Initializing new database (V3)...");
        db.exec(`
          CREATE TABLE items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga')),
            status TEXT NOT NULL CHECK(status IN ('Consuming', 'To Consume', 'Consumed', 'Watching')),
            date_finished TEXT,
            rating INTEGER,
            review TEXT,
            image_path TEXT,
            genre TEXT,
            tags TEXT,
            author TEXT,
            director TEXT,
            writer TEXT,
            actors TEXT,
            studio TEXT,
            platform TEXT,
            priority TEXT DEFAULT 'Normal',
            location TEXT,
            runtime INTEGER,
            page_count INTEGER,
            source TEXT,
            source_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        db.pragma('user_version = 3');
        return;
    }
    const currentVersion = db.pragma('user_version', { simple: true });
    console.log(`Current DB Version: ${currentVersion}`);
    // Check if 'Consuming' is present in CHECK constraint
    const currentSchema = tableInfo.sql || "";
    const hasConsuming = currentSchema.includes("'Consuming'");
    const hasManga = currentSchema.includes("'Manga'");
    if (currentVersion < 3 || !hasConsuming || !hasManga) {
        console.log("Migrating database to v3 (Consuming status, stats & source tracking)...");
        // Convert any existing 'Watching' entries to 'Consuming'
        try {
            db.exec("UPDATE items SET status = 'Consuming' WHERE status = 'Watching'");
        }
        catch (e) {
            console.warn("Could not directly update Watching -> Consuming before schema rewrite", e);
        }
        const transaction = db.transaction(() => {
            // Rename old table
            db.exec('ALTER TABLE items RENAME TO items_old');
            // Create new table with full V3 constraints & columns
            db.exec(`
              CREATE TABLE items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL CHECK(category IN ('Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga')),
                status TEXT NOT NULL CHECK(status IN ('Consuming', 'To Consume', 'Consumed', 'Watching')),
                date_finished TEXT,
                rating INTEGER,
                review TEXT,
                image_path TEXT,
                genre TEXT,
                tags TEXT,
                author TEXT,
                director TEXT,
                writer TEXT,
                actors TEXT,
                studio TEXT,
                platform TEXT,
                priority TEXT DEFAULT 'Normal',
                location TEXT,
                runtime INTEGER,
                page_count INTEGER,
                source TEXT,
                source_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `);
            // Migrate Data dynamically from old table
            const oldColumns = db.prepare("PRAGMA table_info(items_old)").all().map((c) => c.name);
            const validColumns = [
                'id', 'title', 'category', 'status', 'date_finished', 'rating', 'review', 'image_path',
                'genre', 'tags', 'author', 'director', 'writer', 'actors', 'studio', 'platform', 'priority', 'location',
                'runtime', 'page_count', 'source', 'source_id', 'created_at'
            ];
            const colsToCopy = validColumns.filter((c) => oldColumns.includes(c));
            const colsString = colsToCopy.join(', ');
            console.log(`Migrating columns: ${colsString}`);
            db.exec(`INSERT INTO items (${colsString}) SELECT ${colsString} FROM items_old`);
            // Ensure any Watching status is now Consuming
            db.exec("UPDATE items SET status = 'Consuming' WHERE status = 'Watching'");
            // Drop old table
            db.exec('DROP TABLE items_old');
        });
        transaction();
        db.pragma('user_version = 3');
        console.log("Migration to v3 complete.");
    }
};
initSchema();
// Verify and Add Columns (Fallback for minor updates, or if migrations were skipped/failed)
const columnsToAdd = [
    { name: 'genre', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'tags', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'author', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'director', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'writer', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'actors', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'studio', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'platform', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'priority', type: 'TEXT', defaultVal: "'Normal'" },
    { name: 'location', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'runtime', type: 'INTEGER', defaultVal: 'NULL' },
    { name: 'page_count', type: 'INTEGER', defaultVal: 'NULL' },
    { name: 'source', type: 'TEXT', defaultVal: 'NULL' },
    { name: 'source_id', type: 'TEXT', defaultVal: 'NULL' }
];
const existingColumns = db.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
columnsToAdd.forEach(col => {
    if (!existingColumns.includes(col.name)) {
        try {
            console.log(`Adding missing column: ${col.name}`);
            db.exec(`ALTER TABLE items ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.defaultVal}`);
        }
        catch (err) {
            console.error(`Failed to add column ${col.name}`, err);
        }
    }
});
// IPC Handlers
ipcMain.handle('get-items', () => {
    try {
        return db.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
    }
    catch (err) {
        console.error('get-items error:', err);
        return [];
    }
});
ipcMain.handle('add-item', (event, item) => {
    try {
        let status = item.status || 'To Consume';
        if (status === 'Watching')
            status = 'Consuming';
        // Sanitize item to ensure all named parameters exist
        const sanitizedItem = {
            title: item.title,
            category: item.category,
            status: status,
            date_finished: item.date_finished || null,
            rating: item.rating || null,
            review: item.review || null,
            image_path: item.image_path || null,
            genre: item.genre || null,
            tags: item.tags || null,
            author: item.author || null,
            director: item.director || null,
            writer: item.writer || null,
            actors: item.actors || null,
            studio: item.studio || null,
            platform: item.platform || null,
            priority: item.priority || 'Normal',
            location: item.location || null,
            runtime: item.runtime !== undefined && item.runtime !== null ? Number(item.runtime) : null,
            page_count: item.page_count !== undefined && item.page_count !== null ? Number(item.page_count) : null,
            source: item.source || null,
            source_id: item.source_id ? String(item.source_id) : null
        };
        const stmt = db.prepare(`
            INSERT INTO items (
                title, category, status, date_finished, rating, review, image_path,
                genre, tags, author, director, writer, actors, studio, platform, priority, location,
                runtime, page_count, source, source_id
            ) 
            VALUES (
                @title, @category, @status, @date_finished, @rating, @review, @image_path,
                @genre, @tags, @author, @director, @writer, @actors, @studio, @platform, @priority, @location,
                @runtime, @page_count, @source, @source_id
            )
        `);
        return stmt.run(sanitizedItem);
    }
    catch (err) {
        console.error('add-item error:', err);
        throw err;
    }
});
ipcMain.handle('update-item', (event, item) => {
    try {
        let status = item.status || 'To Consume';
        if (status === 'Watching')
            status = 'Consuming';
        // Sanitize item to ensure all named parameters exist
        const sanitizedItem = {
            id: item.id,
            title: item.title,
            category: item.category,
            status: status,
            date_finished: item.date_finished || null,
            rating: item.rating || null,
            review: item.review || null,
            image_path: item.image_path || null,
            genre: item.genre || null,
            tags: item.tags || null,
            author: item.author || null,
            director: item.director || null,
            writer: item.writer || null,
            actors: item.actors || null,
            studio: item.studio || null,
            platform: item.platform || null,
            priority: item.priority || 'Normal',
            location: item.location || null,
            runtime: item.runtime !== undefined && item.runtime !== null ? Number(item.runtime) : null,
            page_count: item.page_count !== undefined && item.page_count !== null ? Number(item.page_count) : null,
            source: item.source || null,
            source_id: item.source_id ? String(item.source_id) : null
        };
        const stmt = db.prepare(`
            UPDATE items 
            SET title = @title, 
                category = @category, 
                status = @status, 
                date_finished = @date_finished, 
                rating = @rating, 
                review = @review, 
                image_path = @image_path,
                genre = @genre,
                tags = @tags,
                author = @author,
                director = @director,
                writer = @writer,
                actors = @actors,
                studio = @studio,
                platform = @platform,
                priority = @priority,
                location = @location,
                runtime = @runtime,
                page_count = @page_count,
                source = @source,
                source_id = @source_id
            WHERE id = @id
        `);
        return stmt.run(sanitizedItem);
    }
    catch (err) {
        console.error('update-item error:', err);
        throw err;
    }
});
ipcMain.handle('delete-item', (event, id) => {
    try {
        return db.prepare('DELETE FROM items WHERE id = ?').run(id);
    }
    catch (err) {
        console.error('delete-item error:', err);
        throw err;
    }
});
ipcMain.handle('import-from-text', async (event) => {
    try {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, message: 'Selection cancelled' };
        }
        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');
        const titles = content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
        if (titles.length === 0) {
            return { success: false, message: 'No valid titles found in file' };
        }
        return { success: true, titles };
    }
    catch (err) {
        console.error('import-from-text error:', err);
        return { success: false, message: err.message };
    }
});
ipcMain.handle('bulk-add-items', (event, { titles, category, status }) => {
    const insert = db.prepare(`
        INSERT INTO items (title, category, status) VALUES (?, ?, ?)
    `);
    const importTransaction = db.transaction((titles) => {
        for (const title of titles) {
            insert.run(title, category, status);
        }
    });
    try {
        importTransaction(titles);
        return { success: true, count: titles.length };
    }
    catch (err) {
        console.error('bulk-add-items error:', err);
        throw err;
    }
});
// Backup Handlers
const AdmZip = require('adm-zip');
ipcMain.handle('backup-create', async () => {
    try {
        const { dialog } = require('electron');
        const zip = new AdmZip();
        // 1. Add Database
        // Note: Ideally we should checkpoint DB first, but for single user app copying file usually works if not under heavy write.
        // Better safety: db.backup(backupPath) then zip it. 
        // For simplicity: Add local file.
        // Warning: Reading open DB file might be risky on Windows.
        // Strategy: Use SQLite backup API to create a safe copy, then zip that.
        const tempBackupPath = path.join(app.getPath('temp'), 'media_tracker_backup.db');
        db.backup(tempBackupPath).then(() => {
            // 2. Add DB to Zip
            zip.addLocalFile(tempBackupPath);
            // 3. Add Covers
            const coversDir = path.join(app.getPath('userData'), 'covers');
            if (fs.existsSync(coversDir)) {
                zip.addLocalFolder(coversDir, 'covers');
            }
        }).catch((err) => {
            throw err;
        });
        // Wait a bit for backup promise? db.backup returns promise.
        // Wait, better-sqlite3 backup is Promise-based.
        await db.backup(tempBackupPath);
        zip.addLocalFile(tempBackupPath, '', 'media_tracker.db'); // Rename in zip
        const coversDir = path.join(app.getPath('userData'), 'covers');
        if (fs.existsSync(coversDir)) {
            zip.addLocalFolder(coversDir, 'covers');
        }
        // Save Dialog
        const { filePath } = await dialog.showSaveDialog({
            buttonLabel: 'Save Backup',
            defaultPath: `MediaTracker_Backup_${new Date().toISOString().split('T')[0]}.zip`,
            filters: [{ name: 'Zip Files', extensions: ['zip'] }]
        });
        if (filePath) {
            zip.writeZip(filePath);
            return { success: true, path: filePath };
        }
        return { success: false, message: 'Cancelled' };
    }
    catch (err) {
        console.error('backup-create error:', err);
        return { success: false, message: err.message };
    }
});
ipcMain.handle('backup-restore', async () => {
    try {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Zip Files', extensions: ['zip'] }]
        });
        if (result.canceled || result.filePaths.length === 0)
            return { success: false };
        const zipPath = result.filePaths[0];
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        // Verification
        const hasDb = zipEntries.some((entry) => entry.entryName === 'media_tracker.db');
        if (!hasDb) {
            return { success: false, message: 'Invalid backup: Missing database file.' };
        }
        // Restoration Logic
        // 1. Close DB
        db.close();
        // 2. Extract DB (Overwrite)
        const userDataPath = app.getPath('userData');
        zip.extractEntryTo('media_tracker.db', userDataPath, false, true);
        // 3. Extract Covers (Overwrite)
        // Check if zip nas 'covers/' folder
        const hasCovers = zipEntries.some((entry) => entry.entryName.startsWith('covers/'));
        if (hasCovers) {
            zip.extractEntryTo('covers/', userDataPath, false, true); // Extract covers/* to userData/covers/*
            // Wait, extractEntryTo extraction target logic for folders:
            // If we extract 'covers/' to userDataPath, it creates userDataPath/covers. Correct.
            // However, verify folder structure in zip.
            // If we used addLocalFolder(dir, 'covers'), entries are 'covers/file.jpg'.
            // extractAllTo might be safer?
            zip.extractAllTo(userDataPath, true);
        }
        else {
            // Just extract DB if no covers
            zip.extractAllTo(userDataPath, true);
        }
        // 4. Relaunch
        app.relaunch();
        app.exit(0);
        return { success: true };
    }
    catch (err) {
        console.error('backup-restore error:', err);
        // If failed, try to reopen DB?
        return { success: false, message: err.message };
    }
});
// Settings Handlers
ipcMain.handle('save-setting', (event, { key, value }) => {
    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        return stmt.run(key, value);
    }
    catch (err) {
        console.error('save-setting error:', err);
        return { success: false, message: err.message };
    }
});
ipcMain.handle('get-setting', (event, key) => {
    try {
        const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
        const row = stmt.get(key);
        return row ? row.value : null;
    }
    catch (err) {
        console.error('get-setting error:', err);
        return null;
    }
});
const getSettingWithEnv = (key, envName) => {
    try {
        const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
        if (row && row.value && row.value.trim()) {
            return row.value.trim();
        }
    }
    catch (e) {
        // Ignore read error
    }
    if (envName && process.env[envName]) {
        return process.env[envName].trim();
    }
    // Fallback: check .env file in root
    try {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            if (envName) {
                const match = envContent.match(new RegExp(`${envName}\\s*=\\s*(["']?)([^"'\\r\\n]+)\\1`));
                if (match)
                    return match[2].trim();
            }
        }
    }
    catch (e) {
        // Ignore fallback error
    }
    return null;
};
// TMDB Handlers
ipcMain.handle('tmdb-search', async (event, query, category, advancedFilters) => {
    try {
        const apiKey = getSettingWithEnv('tmdb_api_key', 'TMDB_API_KEY');
        if (!apiKey) {
            const err = new Error('TMDB API Key is missing. Please configure it in Settings.');
            err.code = 'NO_API_KEY';
            throw err;
        }
        const results = await tmdb.search(query, category || 'Movies', apiKey, advancedFilters);
        return { success: true, results };
    }
    catch (err) {
        console.error('tmdb-search error:', err);
        return {
            success: false,
            error: err.message || 'Unknown search error',
            code: err.code || 'SEARCH_FAILED'
        };
    }
});
ipcMain.handle('tmdb-get-details', async (event, id, type) => {
    try {
        const apiKey = getSettingWithEnv('tmdb_api_key', 'TMDB_API_KEY');
        if (!apiKey) {
            const err = new Error('TMDB API Key is missing. Please configure it in Settings.');
            err.code = 'NO_API_KEY';
            throw err;
        }
        const details = await tmdb.getDetails(id, type, apiKey);
        // Download Poster if available
        if (details.poster_path) {
            const coversDir = path.join(app.getPath('userData'), 'covers');
            if (!fs.existsSync(coversDir)) {
                fs.mkdirSync(coversDir, { recursive: true });
            }
            const fileName = `tmdb_${id}_${Date.now()}.jpg`;
            const localPath = path.join(coversDir, fileName);
            try {
                await tmdb.downloadImage(details.poster_path, localPath);
                details.localImagePath = localPath; // Return local path to frontend
            }
            catch (imgErr) {
                console.error("Failed to download image:", imgErr);
            }
        }
        return { success: true, ...details };
    }
    catch (err) {
        console.error('tmdb-get-details error:', err);
        return {
            success: false,
            error: err.message || 'Unknown details error',
            code: err.code || 'DETAILS_FAILED'
        };
    }
});
// Google Books Handlers
ipcMain.handle('books-search', async (event, query, advancedFilters) => {
    try {
        const apiKey = getSettingWithEnv('google_books_api_key', 'GOOGLE_BOOKS_API_KEY');
        const results = await books.search(query, apiKey, advancedFilters);
        return { success: true, results };
    }
    catch (err) {
        console.error('books-search error:', err);
        return {
            success: false,
            error: err.message || 'Unknown search error',
            code: err.code || 'BOOKS_SEARCH_FAILED'
        };
    }
});
ipcMain.handle('books-get-details', async (event, id) => {
    try {
        const apiKey = getSettingWithEnv('google_books_api_key', 'GOOGLE_BOOKS_API_KEY');
        const details = await books.getDetails(id, apiKey);
        if (details.poster_path) {
            const coversDir = path.join(app.getPath('userData'), 'covers');
            if (!fs.existsSync(coversDir)) {
                fs.mkdirSync(coversDir, { recursive: true });
            }
            const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `book_${safeId}_${Date.now()}.jpg`;
            const localPath = path.join(coversDir, fileName);
            try {
                await books.downloadImage(details.poster_path, localPath);
                details.localImagePath = localPath;
            }
            catch (imgErr) {
                console.error("Failed to download book cover:", imgErr);
            }
        }
        return { success: true, ...details };
    }
    catch (err) {
        console.error('books-get-details error:', err);
        return {
            success: false,
            error: err.message || 'Unknown details error',
            code: err.code || 'BOOKS_DETAILS_FAILED'
        };
    }
});
// AniList Handlers (Anime & Manga)
ipcMain.handle('anilist-search', async (event, query, category, advancedFilters) => {
    try {
        const results = await anilist.search(query, category || 'Anime', advancedFilters);
        return { success: true, results };
    }
    catch (err) {
        console.error('anilist-search error:', err);
        return {
            success: false,
            error: err.message || 'Unknown search error',
            code: err.code || 'ANILIST_SEARCH_FAILED'
        };
    }
});
ipcMain.handle('anilist-get-details', async (event, id, category) => {
    try {
        const details = await anilist.getDetails(id, category || 'Anime');
        if (details.poster_path) {
            const coversDir = path.join(app.getPath('userData'), 'covers');
            if (!fs.existsSync(coversDir)) {
                fs.mkdirSync(coversDir, { recursive: true });
            }
            const fileName = `anilist_${id}_${Date.now()}.jpg`;
            const localPath = path.join(coversDir, fileName);
            try {
                await anilist.downloadImage(details.poster_path, localPath);
                details.localImagePath = localPath;
            }
            catch (imgErr) {
                console.error("Failed to download anime/manga cover:", imgErr);
            }
        }
        return { success: true, ...details };
    }
    catch (err) {
        console.error('anilist-get-details error:', err);
        return {
            success: false,
            error: err.message || 'Unknown details error',
            code: err.code || 'ANILIST_DETAILS_FAILED'
        };
    }
});
// Deduplication Engine
const cleanNormalize = (str) => {
    if (!str)
        return '';
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
};
ipcMain.handle('check-duplicates', () => {
    try {
        const items = db.prepare('SELECT * FROM items ORDER BY id ASC').all();
        // Get dismissed pairs
        const row = db.prepare("SELECT value FROM settings WHERE key = 'dismissed_duplicates'").get();
        let dismissedKeys = [];
        if (row && row.value) {
            try {
                dismissedKeys = JSON.parse(row.value);
            }
            catch (e) { }
        }
        const duplicatePairs = [];
        const seenPairs = new Set();
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const a = items[i];
                const b = items[j];
                const pairKey = `${Math.min(a.id, b.id)}_${Math.max(a.id, b.id)}`;
                if (dismissedKeys.includes(pairKey) || seenPairs.has(pairKey))
                    continue;
                let isDuplicate = false;
                let reason = '';
                // Condition 1: Identical Source and Source ID
                if (a.source && b.source && a.source === b.source && a.source_id && b.source_id && a.source_id === b.source_id) {
                    isDuplicate = true;
                    reason = `Same ${a.source.toUpperCase()} Source ID (${a.source_id})`;
                }
                // Condition 2: Title and Creator / Category match
                if (!isDuplicate) {
                    const normTitleA = cleanNormalize(a.title);
                    const normTitleB = cleanNormalize(b.title);
                    if (normTitleA && normTitleB && normTitleA === normTitleB) {
                        const normCreatorA = cleanNormalize(a.director || a.author || a.studio);
                        const normCreatorB = cleanNormalize(b.director || b.author || b.studio);
                        if (normCreatorA && normCreatorB && normCreatorA === normCreatorB) {
                            isDuplicate = true;
                            reason = 'Matching Title and Creator';
                        }
                        else if (a.category === b.category) {
                            isDuplicate = true;
                            reason = `Identical Title in ${a.category}`;
                        }
                    }
                }
                if (isDuplicate) {
                    seenPairs.add(pairKey);
                    duplicatePairs.push({
                        pairKey,
                        itemA: a,
                        itemB: b,
                        reason
                    });
                }
            }
        }
        return duplicatePairs;
    }
    catch (err) {
        console.error('check-duplicates error:', err);
        return [];
    }
});
ipcMain.handle('dismiss-duplicate', (event, pairKey) => {
    try {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'dismissed_duplicates'").get();
        let dismissedKeys = [];
        if (row && row.value) {
            try {
                dismissedKeys = JSON.parse(row.value);
            }
            catch (e) { }
        }
        if (!dismissedKeys.includes(pairKey)) {
            dismissedKeys.push(pairKey);
            const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('dismissed_duplicates', ?)");
            stmt.run(JSON.stringify(dismissedKeys));
        }
        return { success: true };
    }
    catch (err) {
        console.error('dismiss-duplicate error:', err);
        return { success: false, message: err.message };
    }
});
ipcMain.handle('merge-items', (event, { primaryId, secondaryId }) => {
    try {
        const itemPrimary = db.prepare('SELECT * FROM items WHERE id = ?').get(primaryId);
        const itemSecondary = db.prepare('SELECT * FROM items WHERE id = ?').get(secondaryId);
        if (!itemPrimary || !itemSecondary) {
            return { success: false, message: 'One or both items not found' };
        }
        // Merge attributes into primary if primary lacks them
        const merged = {
            id: itemPrimary.id,
            title: itemPrimary.title || itemSecondary.title,
            category: itemPrimary.category || itemSecondary.category,
            status: itemPrimary.status || itemSecondary.status,
            date_finished: itemPrimary.date_finished || itemSecondary.date_finished,
            rating: itemPrimary.rating || itemSecondary.rating,
            review: itemPrimary.review || itemSecondary.review,
            image_path: itemPrimary.image_path || itemSecondary.image_path,
            genre: itemPrimary.genre || itemSecondary.genre,
            tags: itemPrimary.tags || itemSecondary.tags,
            author: itemPrimary.author || itemSecondary.author,
            director: itemPrimary.director || itemSecondary.director,
            writer: itemPrimary.writer || itemSecondary.writer,
            actors: itemPrimary.actors || itemSecondary.actors,
            studio: itemPrimary.studio || itemSecondary.studio,
            platform: itemPrimary.platform || itemSecondary.platform,
            priority: itemPrimary.priority || itemSecondary.priority,
            location: itemPrimary.location || itemSecondary.location,
            runtime: itemPrimary.runtime || itemSecondary.runtime,
            page_count: itemPrimary.page_count || itemSecondary.page_count,
            source: itemPrimary.source || itemSecondary.source,
            source_id: itemPrimary.source_id || itemSecondary.source_id
        };
        const transaction = db.transaction(() => {
            const updateStmt = db.prepare(`
                UPDATE items 
                SET title = @title, category = @category, status = @status, date_finished = @date_finished,
                    rating = @rating, review = @review, image_path = @image_path, genre = @genre, tags = @tags,
                    author = @author, director = @director, writer = @writer, actors = @actors, studio = @studio,
                    platform = @platform, priority = @priority, location = @location, runtime = @runtime,
                    page_count = @page_count, source = @source, source_id = @source_id
                WHERE id = @id
            `);
            updateStmt.run(merged);
            db.prepare('DELETE FROM items WHERE id = ?').run(secondaryId);
        });
        transaction();
        return { success: true };
    }
    catch (err) {
        console.error('merge-items error:', err);
        return { success: false, message: err.message };
    }
});
// Retroactive Backfill Tool
ipcMain.handle('backfill-missing-stats', async () => {
    try {
        const tmdbApiKey = getSettingWithEnv('tmdb_api_key', 'TMDB_API_KEY');
        const booksApiKey = getSettingWithEnv('google_books_api_key', 'GOOGLE_BOOKS_API_KEY');
        // Select items missing runtime or page_count
        const missing = db.prepare(`
            SELECT * FROM items 
            WHERE (runtime IS NULL AND category IN ('Movies', 'Series', 'Anime'))
               OR (page_count IS NULL AND category IN ('Books', 'Manga'))
            LIMIT 40
        `).all();
        let updatedCount = 0;
        for (const item of missing) {
            try {
                let runtime = null;
                let pageCount = null;
                let source = item.source;
                let sourceId = item.source_id;
                if (item.category === 'Movies' || item.category === 'Series') {
                    if (tmdbApiKey) {
                        let tmdbId = item.source_id;
                        if (!tmdbId) {
                            const searchRes = await tmdb.search(item.title, item.category, tmdbApiKey);
                            if (searchRes && searchRes.length > 0) {
                                tmdbId = searchRes[0].id;
                            }
                        }
                        if (tmdbId) {
                            const details = await tmdb.getDetails(Number(tmdbId), item.category, tmdbApiKey);
                            runtime = details.runtime;
                            source = 'tmdb';
                            sourceId = String(tmdbId);
                        }
                    }
                }
                else if (item.category === 'Anime' || item.category === 'Manga') {
                    let aniId = item.source_id;
                    if (!aniId) {
                        const searchRes = await anilist.search(item.title, item.category);
                        if (searchRes && searchRes.length > 0) {
                            aniId = searchRes[0].id;
                        }
                    }
                    if (aniId) {
                        const details = await anilist.getDetails(Number(aniId), item.category);
                        runtime = details.runtime;
                        pageCount = details.page_count;
                        source = 'anilist';
                        sourceId = String(aniId);
                    }
                }
                else if (item.category === 'Books') {
                    let bookId = item.source_id;
                    if (!bookId) {
                        const searchRes = await books.search(item.title, booksApiKey);
                        if (searchRes && searchRes.length > 0) {
                            bookId = searchRes[0].id;
                        }
                    }
                    if (bookId) {
                        const details = await books.getDetails(String(bookId), booksApiKey);
                        pageCount = details.page_count;
                        source = 'google_books';
                        sourceId = String(bookId);
                    }
                }
                if (runtime !== null || pageCount !== null || sourceId !== item.source_id) {
                    db.prepare(`
                        UPDATE items 
                        SET runtime = COALESCE(?, runtime), 
                            page_count = COALESCE(?, page_count), 
                            source = COALESCE(?, source), 
                            source_id = COALESCE(?, source_id)
                        WHERE id = ?
                    `).run(runtime, pageCount, source, sourceId, item.id);
                    updatedCount++;
                }
            }
            catch (itemErr) {
                console.warn(`Failed to backfill item id ${item.id}:`, itemErr);
            }
        }
        return { success: true, updatedCount, totalProcessed: missing.length };
    }
    catch (err) {
        console.error('backfill-missing-stats error:', err);
        return { success: false, message: err.message };
    }
});
module.exports = db;
