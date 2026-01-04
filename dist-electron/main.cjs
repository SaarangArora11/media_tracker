"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}
let mainWindow = null;
const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'), // Point to .cjs
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            sandbox: false // Explicitly disable sandbox to allow require in preload if needed (though contextIsolation handles it)
        },
        autoHideMenuBar: true,
        backgroundColor: '#242424',
    });
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};
app.on('ready', createWindow);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// Image Handler
ipcMain.handle('select-image', async () => {
    if (!mainWindow)
        return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    const sourcePath = result.filePaths[0];
    const coversDir = path.join(app.getPath('userData'), 'covers');
    if (!fs.existsSync(coversDir)) {
        fs.mkdirSync(coversDir, { recursive: true });
    }
    const ext = path.extname(sourcePath);
    const filename = `${Date.now()}${ext}`;
    const destPath = path.join(coversDir, filename);
    try {
        fs.copyFileSync(sourcePath, destPath);
        return destPath;
    }
    catch (err) {
        console.error('Failed to copy file', err);
        return null;
    }
});
// Setup Database 
require('./database.cjs'); // Point to .cjs
