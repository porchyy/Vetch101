export interface HistoryItem {
  id: string;
  videoId: string;
  url: string;
  title: string;
  thumbnail: string;
  filepath: string;
  ext: string;
  qualityLabel: string;
  filesize?: number | null;
  timestamp: number;
}

const STORAGE_KEY = "vetch101_download_history";
const MAX_HISTORY = 100;

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addHistoryItem(
  item: Omit<HistoryItem, "id" | "timestamp">
): HistoryItem {
  const history = getHistory();
  const newItem: HistoryItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };

  // Dedup by filepath, keep newest at the top up to MAX_HISTORY
  const updated = [newItem, ...history.filter((h) => h.filepath !== item.filepath)].slice(
    0,
    MAX_HISTORY
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Graceful fallback if storage is restricted
  }
  return newItem;
}

export function removeHistoryItem(id: string): void {
  try {
    const history = getHistory().filter((h) => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {}
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
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
