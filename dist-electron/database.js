import Database from 'better-sqlite3';
import { app, ipcMain } from 'electron';
import path from 'path';
// Store DB in user data to persist across updates/relocations
const dbPath = path.join(app.getPath('userData'), 'media_tracker.db');
console.log('Database path:', dbPath);
const db = new Database(dbPath);
// Initialize DB Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Movies', 'Series', 'Anime', 'Books', 'Games')),
    status TEXT NOT NULL CHECK(status IN ('Watching', 'To Consume', 'Consumed')),
    date_finished TEXT,
    rating INTEGER,
    review TEXT,
    image_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
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
        const stmt = db.prepare(`
            INSERT INTO items (title, category, status, date_finished, rating, review, image_path) 
            VALUES (@title, @category, @status, @date_finished, @rating, @review, @image_path)
        `);
        return stmt.run(item);
    }
    catch (err) {
        console.error('add-item error:', err);
        throw err;
    }
});
ipcMain.handle('update-item', (event, item) => {
    try {
        const stmt = db.prepare(`
            UPDATE items 
            SET title = @title, 
                category = @category, 
                status = @status, 
                date_finished = @date_finished, 
                rating = @rating, 
                review = @review, 
                image_path = @image_path
            WHERE id = @id
        `);
        return stmt.run(item);
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
export default db;
