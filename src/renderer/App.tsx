import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

import { ReactComponent as SyncIcon } from '../../assets/icons/sync.svg';

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

export default function App() {
  // ====== 当前展示哪一个界面 ("storage" or "takenOut") ======
  const [currentTab, setCurrentTab] = useState<'storage' | 'takenOut'>('storage');

  // ====== Storage Items ======
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [items, setItems] = useState<Item[]>([]); // 用于搜索过滤后显示

  // ====== TakenOut Items ======
  const [allTakenOutItems, setAllTakenOutItems] = useState<TakenOutItem[]>([]);
  const [takenOutItems, setTakenOutItems] = useState<TakenOutItem[]>([]); // 用于搜索过滤后显示

  // ====== 搜索相关 ======
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchIncludeNotes, setSearchIncludeNotes] = useState(false);
  const [searchLocationFilter, setSearchLocationFilter] = useState('');

  // ====== 添加/编辑物品(对于当前Tab)相关 ======
  const [addMode, setAddMode] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingOutItem, setEditingOutItem] = useState<TakenOutItem | null>(null);

  // 新增输入框
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newNotes, setNewNotes] = useState('');

  // ====== 同步 & 冲突相关 ======
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [remoteItemsCache, setRemoteItemsCache] = useState<Item[]>([]);
  const [remoteTakenOutCache, setRemoteTakenOutCache] = useState<TakenOutItem[]>([]);
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  // ====== ref: 点击浮层外区域时收起浮层 ======
  const advancedSearchRef = useRef<HTMLDivElement | null>(null);
  const syncPanelRef = useRef<HTMLDivElement | null>(null);

  // ====== 加载初始数据 ======
  useEffect(() => {
    window.electron.ipc.getItems().then((data) => {
      setAllItems(data);
      setItems(data);
    });
    window.electron.ipc.getTakenOutItems().then((data) => {
      setAllTakenOutItems(data);
      setTakenOutItems(data);
    });
  }, []);

  // ====== 点击浮层外区域时收起对应浮层 ======
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        advancedSearchRef.current &&
        !advancedSearchRef.current.contains(e.target as Node)
      ) {
        setShowAdvancedSearch(false);
      }
      if (syncPanelRef.current && !syncPanelRef.current.contains(e.target as Node)) {
        setShowSyncPanel(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ====== Storage 位置选项 (供自动补全，包括拿出界面也复用这些location) ======
  const locationOptions = useMemo(() => {
    const setLoc = new Set(allItems.map((it) => it.location));
    return Array.from(setLoc);
  }, [allItems]);

  // ========== 搜索逻辑 ==========
  const handleSearch = async () => {
    if (currentTab === 'storage') {
      const result = await window.electron.ipc.searchItems({
        keyword: searchKeyword,
        includeNotes: searchIncludeNotes,
        locationFilter: searchLocationFilter,
      });
      setItems(result);
    } else {
      const result = await window.electron.ipc.searchTakenOutItems({
        keyword: searchKeyword,
        includeNotes: searchIncludeNotes,
        locationFilter: searchLocationFilter,
      });
      setTakenOutItems(result);
    }
  };

  // ========== 添加物品逻辑 ==========
  const handleAdd = async () => {
    if (!newName || !newLocation) {
      alert('请填写名称和位置');
      return;
    }

    if (currentTab === 'storage') {
      // 添加到 storage
      const newItem = await window.electron.ipc.addItem({
        name: newName,
        location: newLocation,
        quantity: newQuantity,
        notes: newNotes,
      });
      setAllItems((prev) => [...prev, newItem]);
      setItems((prev) => [...prev, newItem]);
    } else {
      // 添加到 takenOut
      const newTakenOut = await window.electron.ipc.addTakenOutItem({
        name: newName,
        originalLocation: newLocation,
        quantity: newQuantity,
        notes: newNotes,
      });
      setAllTakenOutItems((prev) => [...prev, newTakenOut]);
      setTakenOutItems((prev) => [...prev, newTakenOut]);
    }

    // 重置
    setNewName('');
    setNewLocation('');
    setNewQuantity(1);
    setNewNotes('');
    setAddMode(false);
  };

  const handleCancelAdd = () => {
    setNewName('');
    setNewLocation('');
    setNewQuantity(1);
    setNewNotes('');
    setAddMode(false);
  };

  // ========== Storage: 编辑逻辑 ==========
  const startEdit = (item: Item) => {
    setEditingItem(item);
    setEditingOutItem(null);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const updated = await window.electron.ipc.updateItem(editingItem);
    setAllItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setEditingItem(null);
  };

  // ========== TakenOut: 编辑逻辑 ==========
  const startEditTakenOut = (outItem: TakenOutItem) => {
    setEditingItem(null);
    setEditingOutItem(outItem);
  };

  const handleSaveEditTakenOut = async () => {
    if (!editingOutItem) return;
    const updated = await window.electron.ipc.updateTakenOutItem(editingOutItem);
    setAllTakenOutItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setTakenOutItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setEditingOutItem(null);
  };

  // ========== 删除逻辑 ==========
  const handleDelete = async (id: number) => {
    if (currentTab === 'storage') {
      await window.electron.ipc.deleteItem(id);
      setAllItems((prev) => prev.filter((it) => it.id !== id));
      setItems((prev) => prev.filter((it) => it.id !== id));
    } else {
      await window.electron.ipc.deleteTakenOutItem(id);
      setAllTakenOutItems((prev) => prev.filter((it) => it.id !== id));
      setTakenOutItems((prev) => prev.filter((it) => it.id !== id));
    }
  };

  // ========== 拿出逻辑 (在 storage 行点击「拿出」) ==========
  const handleTakeOut = async (id: number) => {
    const resp = await window.electron.ipc.takeOutItem(id);
    if (!resp.success) {
      alert(resp.message || '拿出失败');
      return;
    }
    // 如果成功，就同步更新本地 state
    window.electron.ipc.getItems().then((data) => {
      setAllItems(data);
      setItems(data);
    });
    window.electron.ipc.getTakenOutItems().then((data) => {
      setAllTakenOutItems(data);
      setTakenOutItems(data);
    });
  };

  // ========== 放回逻辑 (在 takenOut 行点击「放回」) ==========
  const handleReturn = async (id: number) => {
    const resp = await window.electron.ipc.returnTakenOutItem(id);
    if (!resp.success) {
      alert(resp.message || '放回失败');
      return;
    }
    // 放回成功后，刷新两边数据
    window.electron.ipc.getItems().then((data) => {
      setAllItems(data);
      setItems(data);
    });
    window.electron.ipc.getTakenOutItems().then((data) => {
      setAllTakenOutItems(data);
      setTakenOutItems(data);
    });
  };

  // ========== 同步逻辑 ==========
  const handleSync = async () => {
    setShowSyncPanel(false);
    const resp = await window.electron.ipc.syncWithFirebase();
    if (!resp.success) {
      alert(`连接 Firebase 失败: ${resp.message || ''}`);
      return;
    }

    const remoteItems = resp.remoteItems || [];
    const remoteTakenOutItems = resp.remoteTakenOutItems || [];

    setRemoteItemsCache(remoteItems);
    setRemoteTakenOutCache(remoteTakenOutItems);

    // 判断差异
    const sameStorage = checkSameItems(allItems, remoteItems);
    const sameTakenOut = checkSameTakenOut(allTakenOutItems, remoteTakenOutItems);

    if (sameStorage && sameTakenOut) {
      alert('当前本地数据与远程数据完全一致，无需覆盖。');
    } else {
      setShowConflictModal(true);
    }
  };

  function checkSameItems(local: Item[], remote: Item[]) {
    if (local.length !== remote.length) return false;
    const mapLocal = new Map(local.map((it) => [it.id, it]));
    for (const rIt of remote) {
      const lIt = mapLocal.get(rIt.id);
      if (
        !lIt ||
        lIt.name !== rIt.name ||
        lIt.location !== rIt.location ||
        lIt.quantity !== rIt.quantity ||
        lIt.notes !== rIt.notes
      ) {
        return false;
      }
    }
    return true;
  }
  function checkSameTakenOut(local: TakenOutItem[], remote: TakenOutItem[]) {
    if (local.length !== remote.length) return false;
    const mapLocal = new Map(local.map((it) => [it.id, it]));
    for (const rIt of remote) {
      const lIt = mapLocal.get(rIt.id);
      if (
        !lIt ||
        lIt.name !== rIt.name ||
        lIt.originalLocation !== rIt.originalLocation ||
        lIt.quantity !== rIt.quantity ||
        lIt.notes !== rIt.notes
      ) {
        return false;
      }
    }
    return true;
  }

  const handleLocalOverwriteRemote = async () => {
    const resp = await window.electron.ipc.overwriteFirebaseByLocal();
    if (!resp.success) {
      alert(`本地覆盖远程失败: ${resp.message || ''}`);
    } else {
      alert('已用本地数据覆盖远程完毕。');
      setShowConflictModal(false);
    }
  };

  const handleRemoteOverwriteLocal = async () => {
    const payload = {
      remoteItems: remoteItemsCache,
      remoteTakenOutItems: remoteTakenOutCache,
    };
    const resp = await window.electron.ipc.overwriteLocalByFirebase(payload);
    if (!resp.success) {
      alert(`远程覆盖本地失败: ${resp.message || ''}`);
    } else {
      setAllItems(remoteItemsCache);
      setItems(remoteItemsCache);
      setAllTakenOutItems(remoteTakenOutCache);
      setTakenOutItems(remoteTakenOutCache);
      alert('已用远程数据覆盖本地完毕。');
      setShowConflictModal(false);
    }
  };

  // ========== 渲染函数: Storage 列表 ==========
  const renderStorageList = () => {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-2">
        {items.map((it) => {
          const isEditing = editingItem && editingItem.id === it.id;

          if (isEditing) {
            // 编辑行
            return (
              <div
                key={it.id}
                className="flex justify-between items-start bg-white p-4 rounded-lg shadow-md"
              >
                {/* 左侧编辑区 */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:space-x-2">
                    <input
                      type="text"
                      className="flex-1 border border-gray-300 rounded-md px-2 py-1 focus:outline-none mb-2 sm:mb-0"
                      value={editingItem.name}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, name: e.target.value })
                      }
                    />
                    <input
                      type="text"
                      list="location-list"
                      className="flex-1 border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                      value={editingItem.location}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, location: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:space-x-2">
                    <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                      <input
                        type="number"
                        min={1}
                        className="w-20 border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                        value={editingItem.quantity}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                      <span className="text-sm text-gray-600">数量</span>
                    </div>
                    <input
                      type="text"
                      className="flex-1 border border-gray-300 rounded-md px-2 py-1 focus:outline-none mt-2 sm:mt-0"
                      value={editingItem.notes}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                {/* 右侧操作区 */}
                <div className="ml-4 flex flex-col space-y-2">
                  <button
                    onClick={handleSaveEdit}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingItem(null)}
                    className="text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-300"
                  >
                    取消
                  </button>
                </div>
              </div>
            );
          } else {
            // 普通行
            return (
              <div
                key={it.id}
                className="flex justify-between items-start bg-white p-4 rounded-lg shadow-md"
              >
                {/* 左侧展示 */}
                <div>
                  <div className="font-semibold text-lg">{it.name}</div>
                  <div className="text-sm text-gray-500 mt-1">位置: {it.location}</div>
                  <div className="mt-1 text-gray-600 text-sm">
                    数量: {it.quantity} &nbsp;|&nbsp; 备注: {it.notes || '(无)'}
                  </div>
                </div>
                {/* 右侧操作按钮 */}
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => startEdit(it)}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleTakeOut(it.id)}
                    className="text-sm bg-yellow-600 text-white px-3 py-1 rounded-md hover:bg-yellow-700"
                  >
                    拿出
                  </button>
                  <button
                    onClick={() => handleDelete(it.id)}
                    className="text-sm bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  };

  // ========== 渲染函数: TakenOut 列表 ==========
  const renderTakenOutList = () => {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-2">
        {takenOutItems.map((out) => {
          const isEditing = editingOutItem && editingOutItem.id === out.id;

          if (isEditing) {
            // 编辑行
            return (
              <div
                key={out.id}
                className="flex justify-between items-start bg-white p-4 rounded-lg shadow-md"
              >
                {/* 左侧编辑区 */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:space-x-2">
                    <input
                      type="text"
                      className="flex-1 border border-gray-300 rounded-md px-2 py-1 focus:outline-none mb-2 sm:mb-0"
                      value={editingOutItem.name}
                      onChange={(e) =>
                        setEditingOutItem({ ...editingOutItem, name: e.target.value })
                      }
                    />
                    <input
                      type="text"
                      list="location-list"
                      className="flex-1 border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                      value={editingOutItem.originalLocation}
                      onChange={(e) =>
                        setEditingOutItem({
                          ...editingOutItem,
                          originalLocation: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:space-x-2">
                    <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                      <input
                        type="number"
                        min={1}
                        className="w-20 border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                        value={editingOutItem.quantity}
                        onChange={(e) =>
                          setEditingOutItem({
                            ...editingOutItem,
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                      <span className="text-sm text-gray-600">数量</span>
                    </div>
                    <input
                      type="text"
                      className="flex-1 border border-gray-300 rounded-md px-2 py-1 focus:outline-none mt-2 sm:mt-0"
                      value={editingOutItem.notes}
                      onChange={(e) =>
                        setEditingOutItem({ ...editingOutItem, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                {/* 右侧操作区 */}
                <div className="ml-4 flex flex-col space-y-2">
                  <button
                    onClick={handleSaveEditTakenOut}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingOutItem(null)}
                    className="text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-300"
                  >
                    取消
                  </button>
                </div>
              </div>
            );
          } else {
            // 普通行
            return (
              <div
                key={out.id}
                className="flex justify-between items-start bg-white p-4 rounded-lg shadow-md"
              >
                {/* 左侧展示 */}
                <div>
                  <div className="font-semibold text-lg">{out.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    原位置: {out.originalLocation}
                  </div>
                  <div className="mt-1 text-gray-600 text-sm">
                    数量: {out.quantity} &nbsp;|&nbsp; 备注: {out.notes || '(无)'}
                  </div>
                </div>
                {/* 右侧操作按钮 */}
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => startEditTakenOut(out)}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleReturn(out.id)}
                    className="text-sm bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700"
                  >
                    放回
                  </button>
                  <button
                    onClick={() => handleDelete(out.id)}
                    className="text-sm bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 text-gray-800">
      {/* ========== 顶部导航栏 ========== */}
      <header className="flex items-center justify-between px-6 py-3 bg-white shadow-md relative">
        {/* 左侧: Tab 切换按钮 */}
        <div className="flex space-x-4">
          <button
            onClick={() => setCurrentTab('storage')}
            className={
              currentTab === 'storage'
                ? 'font-bold text-blue-600'
                : 'text-gray-600 hover:text-black'
            }
          >
            Storage
          </button>
          <button
            onClick={() => setCurrentTab('takenOut')}
            className={
              currentTab === 'takenOut'
                ? 'font-bold text-blue-600'
                : 'text-gray-600 hover:text-black'
            }
          >
            Taken Out
          </button>
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center space-x-4">
          {/* 搜索框 & 高级选项 */}
          <div className="relative" ref={advancedSearchRef}>
            <div className="flex items-center border border-gray-300 rounded-md px-2">
              {/* 搜索图标 */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 text-gray-500 mr-1"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.35 4.35a7.5 7.5 0 0012.3 12.3z"
                />
              </svg>
              {/* 输入框 */}
              <input
                type="text"
                placeholder={
                  currentTab === 'storage' ? '搜索存储物品...' : '搜索拿出物品...'
                }
                className="w-32 sm:w-48 focus:outline-none"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
              />
              {/* 高级选项按钮 */}
              <button
                type="button"
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                className="ml-2 text-sm text-gray-500 hover:text-gray-700"
              >
                高级
              </button>
            </div>
            {/* 高级搜索选项浮层 */}
            {showAdvancedSearch && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white shadow-lg rounded-md p-4 z-50">
                <div className="flex flex-col space-y-2">
                  <label className="flex items-center text-sm space-x-2">
                    <input
                      type="checkbox"
                      checked={searchIncludeNotes}
                      onChange={(e) => setSearchIncludeNotes(e.target.checked)}
                    />
                    <span>包含备注</span>
                  </label>
                  <label className="text-sm font-medium">
                    按存放位置筛选:
                    <select
                      className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                      value={searchLocationFilter}
                      onChange={(e) => setSearchLocationFilter(e.target.value)}
                    >
                      <option value="">（不指定位置）</option>
                      {locationOptions.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={handleSearch}
                    className="mt-2 bg-blue-600 text-white rounded-md px-3 py-1 hover:bg-blue-700"
                  >
                    搜索
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 同步按钮 */}
          <div className="relative" ref={syncPanelRef}>
            <button
              className="p-2 rounded-full hover:bg-gray-100 transition"
              onClick={() => setShowSyncPanel(!showSyncPanel)}
              title="同步"
            >
              <SyncIcon className="w-5 h-5" />
            </button>
            {showSyncPanel && (
              <div className="absolute top-full right-0 mt-2 w-60 bg-white shadow-lg rounded-md p-4 z-50">
                <p className="text-sm mb-3">点击下方进行同步操作：</p>
                <button
                  onClick={handleSync}
                  className="w-full bg-green-600 text-white rounded-md px-3 py-1 hover:bg-green-700"
                >
                  同步到云端
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 冲突弹窗（模态） */}
      {showConflictModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[300px]">
            <p className="text-gray-800 mb-4">检测到本地与远程数据不一致，选择覆盖方式：</p>
            <div className="flex space-x-2">
              <button
                onClick={handleLocalOverwriteRemote}
                className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
              >
                本地覆盖远程
              </button>
              <button
                onClick={handleRemoteOverwriteLocal}
                className="flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700"
              >
                远程覆盖本地
              </button>
            </div>
            <button
              onClick={() => setShowConflictModal(false)}
              className="mt-3 w-full text-center text-sm text-gray-500"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* ========== 主体可滚动区域 ========== */}
      <main className="mt-[4.5rem] flex-1 overflow-auto px-6 py-4">
        {/* ========== 添加区 ========== */}
        <div className="w-full max-w-3xl mx-auto mb-4">
          {!addMode ? (
            <div
              className="w-full bg-white p-4 rounded-lg shadow-md flex items-center justify-center cursor-pointer hover:bg-gray-50"
              onClick={() => setAddMode(true)}
            >
              <span className="text-2xl font-bold text-gray-400">＋</span>
            </div>
          ) : (
            <div className="flex justify-between items-start bg-white p-4 rounded-lg shadow-md">
              {/* 左侧输入区 */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-col sm:flex-row sm:space-x-2">
                  <input
                    type="text"
                    placeholder="物品名称"
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1 focus:outline-none mb-2 sm:mb-0"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder={
                      currentTab === 'storage' ? '存放位置' : 'Original Location'
                    }
                    list="location-list"
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                  />
                  <datalist id="location-list">
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-col sm:flex-row sm:space-x-2">
                  <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                    <input
                      type="number"
                      min={1}
                      className="w-20 border border-gray-300 rounded-md px-2 py-1 focus:outline-none"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(Number(e.target.value))}
                    />
                    <span className="text-sm text-gray-600">数量</span>
                  </div>
                  <input
                    type="text"
                    placeholder="备注"
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1 focus:outline-none mt-2 sm:mt-0"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                  />
                </div>
              </div>
              {/* 右侧按钮区 */}
              <div className="ml-4 flex flex-col space-y-2">
                <button
                  onClick={handleAdd}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
                >
                  确定
                </button>
                <button
                  onClick={handleCancelAdd}
                  className="text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========== 列表区域 ========== */}
        {currentTab === 'storage' ? renderStorageList() : renderTakenOutList()}
      </main>
    </div>
  );
}
