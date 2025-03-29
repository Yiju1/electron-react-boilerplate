import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    // 1) 获取所有物品（全量）
    getItems: () => ipcRenderer.invoke('get-items'),

    // 2) 添加物品
    addItem: (data: {
      name: string;
      location: string;
      quantity: number;
      notes: string;
    }) => ipcRenderer.invoke('add-item', data),

    // 3) 更新物品
    updateItem: (data: {
      id: number;
      name: string;
      location: string;
      quantity: number;
      notes: string;
    }) => ipcRenderer.invoke('update-item', data),

    // 4) 删除物品
    deleteItem: (id: number) => ipcRenderer.invoke('delete-item', id),

    // 5) 搜索
    searchItems: (args: {
      keyword: string;
      includeNotes: boolean;
      locationFilter: string;
    }) => ipcRenderer.invoke('search-items', args),

    // 6) 同步
    syncWithFirebase: () => ipcRenderer.invoke('sync-with-firebase'),

    // 7) 覆盖：本地 -> Firebase
    overwriteFirebaseByLocal: () => ipcRenderer.invoke('overwrite-firebase-by-local'),

    // 8) 覆盖：Firebase -> 本地
    overwriteLocalByFirebase: (remoteItems: any) =>
      ipcRenderer.invoke('overwrite-local-by-firebase', remoteItems),
  },
});
