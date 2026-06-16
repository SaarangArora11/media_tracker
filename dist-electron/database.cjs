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
const initSchema = () => {
    // Check if 'settings' table exists
    const settingsTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='settings'").get();
    if (!settingsTable) {
        db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)");
        console.log("Created 'settings' table.");
    }
    // Robust Schema Check: Read the actual CREATE statement
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'").get();
    // If table doesn't exist, create it fresh
    if (!tableInfo) {
        console.log("Initializing new database...");
        db.exec(`
          CREATE TABLE items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga')),
            status TEXT NOT NULL CHECK(status IN ('Watching', 'To Consume', 'Consumed')),
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
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        db.pragma('user_version = 2');
        return;
    }
    // Check current schema version
    // Version 0: Initial
    // Version 1: Manga Support + Priority
    // Version 2: Location Support
    const currentVersion = db.pragma('user_version', { simple: true });
    console.log(`Current DB Version: ${currentVersion}`);
    if (currentVersion < 2) {
        // Perform v2 migration (Add Location)
        console.log("Migrating database to v2 (Location Support)...");
        const columns = db.prepare("PRAGMA table_info(items)").all().map((c) => c.name);
        if (!columns.includes('location')) {
            try {
                db.exec("ALTER TABLE items ADD COLUMN location TEXT");
                console.log("Added 'location' column.");
            }
            catch (err) {
                console.error("Failed to add location column:", err);
            }
        }
        db.pragma('user_version = 2');
        console.log("Migration to v2 complete.");
    }
    // Fallback Verification
    const finalColumns = db.prepare("PRAGMA table_info(items)").all().map((c) => c.name);
    if (!finalColumns.includes('category')) {
        // ... (Original creation logic if needed, but we rely on migration above for existing DBs)
    }
    // Check if 'Manga' is missing from the schema definition
    const currentSchema = tableInfo.sql || "";
    const hasManga = currentSchema.includes("'Manga'");
    if (!hasManga) {
        console.log("Detected missing 'Manga' support. Forcing migration...");
        const transaction = db.transaction(() => {
            // Rename old table
            db.exec('ALTER TABLE items RENAME TO items_old');
            // Create new table with Manga support
            db.exec(`
              CREATE TABLE items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL CHECK(category IN ('Movies', 'Series', 'Anime', 'Books', 'Games', 'Manga')),
                status TEXT NOT NULL CHECK(status IN ('Watching', 'To Consume', 'Consumed')),
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `);
            // Migrate Data
            // Get columns from old table dynamically to be safe
            const oldColumns = db.prepare("PRAGMA table_info(items_old)").all().map((c) => c.name);
            const validColumns = [
                'id', 'title', 'category', 'status', 'date_finished', 'rating', 'review', 'image_path',
                'genre', 'tags', 'author', 'director', 'writer', 'actors', 'studio', 'platform', 'priority', 'location', 'created_at'
            ];
            const colsToCopy = validColumns.filter((c) => oldColumns.includes(c));
            const colsString = colsToCopy.join(', '); // e.g. "id, title, category..."
            console.log(`Migrating columns: ${colsString}`);
            db.exec(`INSERT INTO items (${colsString}) SELECT ${colsString} FROM items_old`);
            // Drop old table
            db.exec('DROP TABLE items_old');
        });
        transaction();
        console.log("Manga support migration complete.");
    }
    else {
        console.log("Database schema already supports Manga.");
    }
    // Ensure the user_version is updated to the latest after all migrations
    if (db.pragma('user_version', { simple: true }) < currentVersion) {
        db.pragma(`user_version = ${currentVersion}`);
        console.log(`Database user_version updated to ${currentVersion}.`);
    }
};
initSchema();
// Verify and Add Columns (Fallback for minor updates, or if migrations were skipped/failed)
const columnsToAdd = [
    'genre', 'tags', 'author', 'director', 'writer', 'actors', 'studio', 'platform', 'priority', 'location'
];
const existingColumns = db.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
columnsToAdd.forEach(col => {
    if (!existingColumns.includes(col)) {
        try {
            console.log(`Adding missing column: ${col}`);
            const defaultVal = col === 'priority' ? "'Normal'" : "NULL";
            db.exec(`ALTER TABLE items ADD COLUMN ${col} TEXT DEFAULT ${defaultVal}`);
        }
        catch (err) {
            console.error(`Failed to add column ${col}`, err);
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
        // Sanitize item to ensure all named parameters exist
        const sanitizedItem = {
            title: item.title,
            category: item.category,
            status: item.status,
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
            location: item.location || null
        };
        const stmt = db.prepare(`
            INSERT INTO items (
                title, category, status, date_finished, rating, review, image_path,
                genre, tags, author, director, writer, actors, studio, platform, priority, location
            ) 
            VALUES (
                @title, @category, @status, @date_finished, @rating, @review, @image_path,
                @genre, @tags, @author, @director, @writer, @actors, @studio, @platform, @priority, @location
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
        // Sanitize item to ensure all named parameters exist
        const sanitizedItem = {
            id: item.id,
            title: item.title,
            category: item.category,
            status: item.status,
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
            location: item.location || null
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
                location = @location
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
// TMDB Handlers
ipcMain.handle('tmdb-search', async (event, query, category) => {
    try {
        const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'tmdb_api_key'").get()?.value;
        if (!apiKey)
            throw new Error('API Key not found');
        return await tmdb.search(query, category || 'Movies', apiKey);
    }
    catch (err) {
        console.error('tmdb-search error:', err);
        return { success: false, error: err.message };
    }
});
ipcMain.handle('tmdb-get-details', async (event, id, type) => {
    try {
        const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'tmdb_api_key'").get()?.value;
        if (!apiKey)
            throw new Error('API Key not found');
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
                // Fallback to URL or null if download fails, but keeping URL might be useful
                // details.localImagePath = details.poster_path; 
            }
        }
        return details;
    }
    catch (err) {
        console.error('tmdb-get-details error:', err);
        const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'tmdb_api_key'").get()?.value; // Re-fetch to be safe or just fail
        return { success: false, error: err.message };
    }
});
module.exports = db;
