import { useCallback, useState } from "react";

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  platform: string;
  ext: string;
  date: number;
  filename?: string;
  filepath?: string;
  filesize?: number | null;
  thumbnail?: string;
}

export interface HistoryCriteria {
  id?: string;
  date?: number;
  url?: string;
}

export type HistoryTarget = string | number | HistoryCriteria;

export const HISTORY_STORAGE_KEY = "vetch101_history_v3";
export const MAX_HISTORY = 50;

export function detectPlatform(urlStr: string): string {
  try {
    const host = new URL(urlStr).hostname.replace(/^www\./, "");
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
    if (host.includes("tiktok.com")) return "TikTok";
    if (host.includes("facebook.com") || host.includes("fb.watch")) return "Facebook";
    if (host.includes("instagram.com")) return "Instagram";
    if (host.includes("x.com") || host.includes("twitter.com")) return "X";
    if (host.includes("soundcloud.com")) return "SoundCloud";
    return host;
  } catch {
    return "เว็บวิดีโอ";
  }
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

export function getHistory(storage?: StorageLike): HistoryItem[] {
  const store = resolveStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addHistoryItem(
  item: Omit<HistoryItem, "id" | "date"> & { id?: string; date?: number },
  storage?: StorageLike,
): HistoryItem {
  const store = resolveStorage(storage);
  const history = getHistory(storage);
  const now = item.date || Date.now();
  const id = item.id || `${now}-${Math.random().toString(36).slice(2, 7)}`;

  const existingIndex = history.findIndex(
    (h) => h.url === item.url || Boolean(item.filepath && h.filepath === item.filepath),
  );

  let fullItem: HistoryItem;
  let remaining: HistoryItem[];

  if (existingIndex >= 0) {
    const existing = history[existingIndex];
    fullItem = {
      ...existing,
      ...item,
      id: existing.id,
      date: now,
    };
    remaining = history.filter((_, idx) => idx !== existingIndex);
  } else {
    fullItem = {
      ...item,
      id,
      date: now,
    };
    remaining = history;
  }

  const updated = [fullItem, ...remaining].slice(0, MAX_HISTORY);

  if (store) {
    try {
      store.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Graceful fallback if storage quota exceeded or restricted
    }
  }

  return fullItem;
}

export function removeHistoryItem(
  target: HistoryTarget,
  storage?: StorageLike,
): HistoryItem[] {
  const store = resolveStorage(storage);
  const history = getHistory(storage);
  const updated = history.filter((item) => {
    if (typeof target === "number") {
      return item.date !== target;
    }
    if (typeof target === "string") {
      return item.id !== target && item.url !== target;
    }
    if (target && typeof target === "object") {
      if (target.id !== undefined && item.id === target.id) return false;
      if (target.date !== undefined && item.date === target.date) return false;
      if (target.url !== undefined && item.url === target.url) return false;
      return true;
    }
    return true;
  });

  if (store) {
    try {
      store.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  return updated;
}

export function removeHistoryByDate(
  date: number,
  storage?: StorageLike,
): HistoryItem[] {
  return removeHistoryItem({ date }, storage);
}

export function removeHistoryById(
  id: string,
  storage?: StorageLike,
): HistoryItem[] {
  return removeHistoryItem({ id }, storage);
}

export function removeHistoryByUrl(
  url: string,
  storage?: StorageLike,
): HistoryItem[] {
  return removeHistoryItem({ url }, storage);
}

export function clearHistory(storage?: StorageLike): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.removeItem(HISTORY_STORAGE_KEY);
  } catch {}
}

export function useHistory(storage?: StorageLike) {
  const [history, setHistory] = useState<HistoryItem[]>(() => getHistory(storage));

  const add = useCallback(
    (item: Omit<HistoryItem, "id" | "date"> & { id?: string; date?: number }) => {
      const added = addHistoryItem(item, storage);
      setHistory(getHistory(storage));
      return added;
    },
    [storage]
  );

  const remove = useCallback(
    (target: HistoryTarget) => {
      const updated = removeHistoryItem(target, storage);
      setHistory(updated);
      return updated;
    },
    [storage]
  );

  const clear = useCallback(() => {
    clearHistory(storage);
    setHistory([]);
  }, [storage]);

  const reload = useCallback(() => {
    setHistory(getHistory(storage));
  }, [storage]);

  return {
    history,
    addHistoryItem: add,
    removeHistoryItem: remove,
    clearHistory: clear,
    reloadHistory: reload,
  };
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let unitIndex = 0;
  while (val >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex++;
  }
  return `~${val.toFixed(val >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
