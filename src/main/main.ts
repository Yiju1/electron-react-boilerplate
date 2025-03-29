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

let items: Item[] = [];

const DATA_FILE_PATH = path.join(app.getPath('userData'), 'items.json');

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
    console.error('读取本地数据失败', error);
    items = [];
  }
}

function saveItems() {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(items, null, 2), 'utf-8');
  } catch (error) {
    console.error('写入本地数据失败', error);
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
  mainWindow.webContents.openDevTools()
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
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// =============== 4. CRUD ===============
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

// =============== 5. 搜索 ===============
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

// =============== 6. Firebase 同步 ===============

// ✅ 修复：防止 undefined 字段写入 Firebase
function sanitizeItem(it: Partial<Item>): Item {
  return {
    id: it.id ?? Date.now(),
    name: it.name ?? '',
    location: it.location ?? '',
    quantity: typeof it.quantity === 'number' ? it.quantity : 1,
    notes: it.notes ?? '',
  };
}

ipcMain.handle('sync-with-firebase', async () => {
  try {
    const colRef = collection(db, 'items');
    const snapshot = await getDocs(colRef);
    const remoteItems: Item[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      remoteItems.push(sanitizeItem(data));
    });

    return { success: true, remoteItems };
  } catch (err: any) {
    console.error('连接 Firebase 失败: ', err);
    return { success: false, message: err?.message || '连接 Firebase 失败' };
  }
});

ipcMain.handle('overwrite-firebase-by-local', async () => {
  try {
    for (const it of items) {
      const cleanItem = sanitizeItem(it);
      const docRef = doc(db, 'items', String(cleanItem.id));
      await setDoc(docRef, cleanItem);
    }
    return { success: true };
  } catch (err: any) {
    console.error('本地覆盖 Firebase 失败: ', err);
    return { success: false, message: err?.message || '本地覆盖失败' };
  }
});

ipcMain.handle('overwrite-local-by-firebase', async (_event, remoteItems: Item[]) => {
  try {
    items = remoteItems.map(sanitizeItem);
    saveItems();
    return { success: true };
  } catch (err: any) {
    console.error('远程覆盖本地失败: ', err);
    return { success: false, message: err?.message || '远程覆盖失败' };
  }
});
