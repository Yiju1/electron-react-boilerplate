export interface Item {
  id: number;
  name: string;
  location: string;
  quantity: number;
  notes: string;
}

export interface TakenOutItem {
  id: number;
  name: string;
  originalLocation: string;
  quantity: number;
  notes: string;
}

declare global {
  interface Window {
    electron: {
      ipc: {
        // ========== storage items ==========
        getItems: () => Promise<Item[]>;
        addItem: (data: Omit<Item, 'id'>) => Promise<Item>;
        updateItem: (data: Item) => Promise<Item>;
        deleteItem: (id: number) => Promise<number>;
        searchItems: (args: {
          keyword: string;
          includeNotes: boolean;
          locationFilter: string;
        }) => Promise<Item[]>;

        // ========== take out ==========
        takeOutItem: (id: number) => Promise<{
          success: boolean;
          message?: string;
          takenOut?: TakenOutItem;
        }>;

        // ========== taken-out items ==========
        getTakenOutItems: () => Promise<TakenOutItem[]>;
        addTakenOutItem: (data: Omit<TakenOutItem, 'id'>) => Promise<TakenOutItem>;
        updateTakenOutItem: (data: TakenOutItem) => Promise<TakenOutItem>;
        deleteTakenOutItem: (id: number) => Promise<number>;
        searchTakenOutItems: (args: {
          keyword: string;
          includeNotes: boolean;
          locationFilter: string;
        }) => Promise<TakenOutItem[]>;

        // ========== return ==========
        returnTakenOutItem: (id: number) => Promise<{ success: boolean; message?: string }>;

        // ========== 同步 ==========
        syncWithFirebase: () => Promise<{
          success: boolean;
          remoteItems?: Item[];
          remoteTakenOutItems?: TakenOutItem[];
          message?: string;
        }>;
        overwriteFirebaseByLocal: () => Promise<{ success: boolean; message?: string }>;
        overwriteLocalByFirebase: (payload: {
          remoteItems: Item[];
          remoteTakenOutItems: TakenOutItem[];
        }) => Promise<{ success: boolean; message?: string }>;
      };
    };
  }
}

export {};
