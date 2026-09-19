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
  idOrDate: string | number,
  storage?: StorageLike,
): HistoryItem[] {
  const store = resolveStorage(storage);
  const history = getHistory(storage);
  const updated = history.filter((item) => {
    if (typeof idOrDate === "number") {
      return item.date !== idOrDate;
    }
    return item.id !== idOrDate && item.url !== idOrDate;
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
  return removeHistoryItem(date, storage);
}

export function removeHistoryById(
  id: string,
  storage?: StorageLike,
): HistoryItem[] {
  return removeHistoryItem(id, storage);
}

export function clearHistory(storage?: StorageLike): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.removeItem(HISTORY_STORAGE_KEY);
  } catch {}
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
