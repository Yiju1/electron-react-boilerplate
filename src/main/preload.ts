import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    // ========== storage items ==========
    getItems: () => ipcRenderer.invoke('get-items'),
    addItem: (data: { name: string; location: string; quantity: number; notes: string }) =>
      ipcRenderer.invoke('add-item', data),
    updateItem: (data: {
      id: number;
      name: string;
      location: string;
      quantity: number;
      notes: string;
    }) => ipcRenderer.invoke('update-item', data),
    deleteItem: (id: number) => ipcRenderer.invoke('delete-item', id),
    searchItems: (args: {
      keyword: string;
      includeNotes: boolean;
      locationFilter: string;
    }) => ipcRenderer.invoke('search-items', args),

    // ========== take out ==========
    takeOutItem: (id: number) => ipcRenderer.invoke('take-out-item', id),

    // ========== taken-out items ==========
    getTakenOutItems: () => ipcRenderer.invoke('get-taken-out-items'),
    addTakenOutItem: (data: {
      name: string;
      originalLocation: string;
      quantity: number;
      notes: string;
    }) => ipcRenderer.invoke('add-taken-out-item', data),
    updateTakenOutItem: (data: {
      id: number;
      name: string;
      originalLocation: string;
      quantity: number;
      notes: string;
    }) => ipcRenderer.invoke('update-taken-out-item', data),
    deleteTakenOutItem: (id: number) => ipcRenderer.invoke('delete-taken-out-item', id),
    searchTakenOutItems: (args: {
      keyword: string;
      includeNotes: boolean;
      locationFilter: string;
    }) => ipcRenderer.invoke('search-taken-out-items', args),

    // ========== return ==========
    returnTakenOutItem: (id: number) => ipcRenderer.invoke('return-taken-out-item', id),

    // ========== 同步 ==========
    syncWithFirebase: () => ipcRenderer.invoke('sync-with-firebase'),
    overwriteFirebaseByLocal: () => ipcRenderer.invoke('overwrite-firebase-by-local'),
    overwriteLocalByFirebase: (payload: any) =>
      ipcRenderer.invoke('overwrite-local-by-firebase', payload),
  },
});
