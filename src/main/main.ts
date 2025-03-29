import fs from 'fs';
import path from 'path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

// =============== 1. Firebase 相关 ===============
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCu8aZLmTs7Y9FHN6Oebb3NvnR7LrJfpXU',
  authDomain: 'storage-67d3c.firebaseapp.com',
  projectId: 'storage-67d3c',
  storageBucket: 'storage-67d3c.firebasestorage.app',
  messagingSenderId: '359518783145',
  appId: '1:359518783145:web:044b2628d5359f34ae0bb8',
  measurementId: 'G-DBHNZ1Z7F5',
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// =============== 2. 数据结构 + 本地文件位置 ===============
interface Item {
  id: number;
  name: string;
  location: string;
  quantity: number;
  notes: string;
}

interface TakenOutItem {
  id: number;
  name: string;
  originalLocation: string;
  quantity: number;
  notes: string;
}

let items: Item[] = [];
let takenOutItems: TakenOutItem[] = [];

const DATA_FILE_PATH = path.join(app.getPath('userData'), 'items.json');
const TAKEN_OUT_DATA_FILE_PATH = path.join(app.getPath('userData'), 'takenOutItems.json');

function loadItems() {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      items = JSON.parse(raw);
    } else {
      items = [];
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(items, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('读取本地数据失败 (items)', error);
    items = [];
  }
}

function saveItems() {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(items, null, 2), 'utf-8');
  } catch (error) {
    console.error('写入本地数据失败 (items)', error);
  }
}

function loadTakenOutItems() {
  try {
    if (fs.existsSync(TAKEN_OUT_DATA_FILE_PATH)) {
      const raw = fs.readFileSync(TAKEN_OUT_DATA_FILE_PATH, 'utf-8');
      takenOutItems = JSON.parse(raw);
    } else {
      takenOutItems = [];
      fs.writeFileSync(
        TAKEN_OUT_DATA_FILE_PATH,
        JSON.stringify(takenOutItems, null, 2),
        'utf-8'
      );
    }
  } catch (error) {
    console.error('读取本地数据失败 (takenOutItems)', error);
    takenOutItems = [];
  }
}

function saveTakenOutItems() {
  try {
    fs.writeFileSync(
      TAKEN_OUT_DATA_FILE_PATH,
      JSON.stringify(takenOutItems, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('写入本地数据失败 (takenOutItems)', error);
  }
}

// =============== 3. 创建主窗口 ===============
let mainWindow: BrowserWindow | null = null;

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) throw new Error('"mainWindow" is not defined');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
  mainWindow.webContents.openDevTools();
  new AppUpdater();
};

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

app.whenReady().then(() => {
  loadItems();
  loadTakenOutItems();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// =============== 4. CRUD - storage items ===============
ipcMain.handle('get-items', async () => {
  return items;
});

ipcMain.handle('add-item', async (_event, data: Omit<Item, 'id'>) => {
  const newItem: Item = {
    id: Date.now(),
    ...data,
  };
  items.push(newItem);
  saveItems();
  return newItem;
});

ipcMain.handle('update-item', async (_event, updated: Item) => {
  items = items.map((it) => (it.id === updated.id ? updated : it));
  saveItems();
  return updated;
});

ipcMain.handle('delete-item', async (_event, id: number) => {
  items = items.filter((it) => it.id !== id);
  saveItems();
  return id;
});

// =============== 5. 搜索 - storage items ===============
ipcMain.handle(
  'search-items',
  async (
    _event,
    {
      keyword,
      includeNotes,
      locationFilter,
    }: { keyword: string; includeNotes: boolean; locationFilter: string }
  ) => {
    let result = items;

    if (locationFilter) {
      result = result.filter((it) => it.location === locationFilter);
    }

    if (keyword) {
      result = result.filter((it) => {
        const inName = it.name.includes(keyword);
        const inNotes = includeNotes && (it.notes ?? '').includes(keyword);
        return inName || inNotes;
      });
    }

    return result;
  }
);

// =============== 6. 拿出 - 减少 storage item 并在 takenOutItems 中记录 ===============
ipcMain.handle('take-out-item', async (_event, id: number) => {
  const idx = items.findIndex((it) => it.id === id);
  if (idx === -1) {
    return { success: false, message: '未找到对应的 storage 物品' };
  }

  // 如果数量 > 0 则减 1
  if (items[idx].quantity > 0) {
    items[idx].quantity -= 1;
    saveItems();

    const originItem = items[idx];
    // 新增一条 takenOut 记录 (示例：每次拿出数量为 1)
    const newTakenOut: TakenOutItem = {
      id: Date.now(),
      name: originItem.name,
      originalLocation: originItem.location,
      quantity: 1,
      notes: originItem.notes,
    };
    takenOutItems.push(newTakenOut);
    saveTakenOutItems();

    return { success: true, takenOut: newTakenOut };
  } else {
    return { success: false, message: '数量已为0，无法再拿出' };
  }
});

// =============== 7. CRUD - taken out items ===============
ipcMain.handle('get-taken-out-items', async () => {
  return takenOutItems;
});

ipcMain.handle('add-taken-out-item', async (_event, data: Omit<TakenOutItem, 'id'>) => {
  const newItem: TakenOutItem = {
    id: Date.now(),
    ...data,
  };
  takenOutItems.push(newItem);
  saveTakenOutItems();
  return newItem;
});

ipcMain.handle('update-taken-out-item', async (_event, updated: TakenOutItem) => {
  takenOutItems = takenOutItems.map((it) => (it.id === updated.id ? updated : it));
  saveTakenOutItems();
  return updated;
});

ipcMain.handle('delete-taken-out-item', async (_event, id: number) => {
  takenOutItems = takenOutItems.filter((it) => it.id !== id);
  saveTakenOutItems();
  return id;
});

// =============== 8. 搜索 - taken out items ===============
ipcMain.handle(
  'search-taken-out-items',
  async (
    _event,
    {
      keyword,
      includeNotes,
      locationFilter,
    }: { keyword: string; includeNotes: boolean; locationFilter: string }
  ) => {
    let result = takenOutItems;

    if (locationFilter) {
      result = result.filter((it) => it.originalLocation === locationFilter);
    }

    if (keyword) {
      result = result.filter((it) => {
        const inName = it.name.includes(keyword);
        const inNotes = includeNotes && (it.notes ?? '').includes(keyword);
        return inName || inNotes;
      });
    }

    return result;
  }
);

// =============== 9. 放回 - 在 takenOutItems 中减1，并加回到 storage ===============
ipcMain.handle('return-taken-out-item', async (_event, id: number) => {
  // 找到对应 takenOutItem
  const idx = takenOutItems.findIndex((to) => to.id === id);
  if (idx === -1) {
    return { success: false, message: '未找到对应的 takenOut 物品' };
  }

  const outItem = takenOutItems[idx];
  // 先把 takenOutItems[idx] 数量减 1
  outItem.quantity -= 1;

  // 在 storage 里找有没有 name + location 一样的
  const storageIdx = items.findIndex(
    (it) => it.name === outItem.name && it.location === outItem.originalLocation
  );

  if (storageIdx !== -1) {
    // 找到则数量 +1
    items[storageIdx].quantity += 1;
  } else {
    // 否则新建一个
    const newStorageItem: Item = {
      id: Date.now(),
      name: outItem.name,
      location: outItem.originalLocation,
      quantity: 1,
      notes: outItem.notes,
    };
    items.push(newStorageItem);
  }

  // 如果 outItem 数量减到 0，删除之
  if (outItem.quantity <= 0) {
    takenOutItems.splice(idx, 1);
  }

  saveItems();
  saveTakenOutItems();

  return { success: true };
});

// =============== 10. Firebase 同步 ===============
function sanitizeItem(it: Partial<Item>): Item {
  return {
    id: it.id ?? Date.now(),
    name: it.name ?? '',
    location: it.location ?? '',
    quantity: typeof it.quantity === 'number' ? it.quantity : 1,
    notes: it.notes ?? '',
  };
}
function sanitizeTakenOutItem(it: Partial<TakenOutItem>): TakenOutItem {
  return {
    id: it.id ?? Date.now(),
    name: it.name ?? '',
    originalLocation: it.originalLocation ?? '',
    quantity: typeof it.quantity === 'number' ? it.quantity : 1,
    notes: it.notes ?? '',
  };
}

ipcMain.handle('sync-with-firebase', async () => {
  try {
    // 1) 读取 items
    const colRefItems = collection(db, 'items');
    const snapshotItems = await getDocs(colRefItems);
    const remoteItems: Item[] = [];
    snapshotItems.forEach((docSnap) => {
      remoteItems.push(sanitizeItem(docSnap.data()));
    });

    // 2) 读取 takenOutItems
    const colRefTakenOut = collection(db, 'takenOutItems');
    const snapshotTakenOut = await getDocs(colRefTakenOut);
    const remoteTakenOutItems: TakenOutItem[] = [];
    snapshotTakenOut.forEach((docSnap) => {
      remoteTakenOutItems.push(sanitizeTakenOutItem(docSnap.data()));
    });

    return {
      success: true,
      remoteItems,
      remoteTakenOutItems,
    };
  } catch (err: any) {
    console.error('连接 Firebase 失败: ', err);
    return { success: false, message: err?.message || '连接 Firebase 失败' };
  }
});

ipcMain.handle('overwrite-firebase-by-local', async () => {
  try {
    // 1) 写入 items
    for (const it of items) {
      const cleanItem = sanitizeItem(it);
      const docRef = doc(db, 'items', String(cleanItem.id));
      await setDoc(docRef, cleanItem);
    }

    // 2) 写入 takenOutItems
    for (const outIt of takenOutItems) {
      const cleanOut = sanitizeTakenOutItem(outIt);
      const docRef = doc(db, 'takenOutItems', String(cleanOut.id));
      await setDoc(docRef, cleanOut);
    }

    return { success: true };
  } catch (err: any) {
    console.error('本地覆盖 Firebase 失败: ', err);
    return { success: false, message: err?.message || '本地覆盖失败' };
  }
});

ipcMain.handle(
  'overwrite-local-by-firebase',
  async (
    _event,
    {
      remoteItems,
      remoteTakenOutItems,
    }: { remoteItems: Item[]; remoteTakenOutItems: TakenOutItem[] }
  ) => {
    try {
      items = remoteItems.map(sanitizeItem);
      saveItems();

      takenOutItems = remoteTakenOutItems.map(sanitizeTakenOutItem);
      saveTakenOutItems();

      return { success: true };
    } catch (err: any) {
      console.error('远程覆盖本地失败: ', err);
      return { success: false, message: err?.message || '远程覆盖失败' };
    }
  }
);
