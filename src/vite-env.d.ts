/// <reference types="vite/client" />

interface ElectronAPI {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
}

interface Window {
    electronAPI: ElectronAPI;
}
