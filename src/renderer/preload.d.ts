export interface Item {
  id: number;
  name: string;
  location: string;
  quantity: number;
  notes: string;
}

declare global {
  interface Window {
    electron: {
      ipc: {
        getItems: () => Promise<Item[]>;
        addItem: (data: Omit<Item, 'id'>) => Promise<Item>;
        updateItem: (data: Item) => Promise<Item>;
        deleteItem: (id: number) => Promise<number>;
        searchItems: (args: {
          keyword: string;
          includeNotes: boolean;
          locationFilter: string;
        }) => Promise<Item[]>;

        // 新增: 同步相关
        syncWithFirebase: () => Promise<{
          success: boolean;
          remoteItems?: Item[];
          message?: string;
        }>;
        overwriteFirebaseByLocal: () => Promise<{ success: boolean; message?: string }>;
        overwriteLocalByFirebase: (remoteItems: Item[]) => Promise<{
          success: boolean;
          message?: string;
        }>;
      };
    };
  }
}

export {};
