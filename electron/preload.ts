import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // We will add specific methods here later
    ping: () => ipcRenderer.invoke('ping'),
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
});
