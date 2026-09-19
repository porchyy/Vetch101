import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBytes,
  getHistory,
  addHistoryItem,
  removeHistoryItem,
  clearHistory,
  detectPlatform,
  MAX_HISTORY,
  HISTORY_STORAGE_KEY,
} from "../src/history.ts";

function createMockStorage(initialData = {}) {
  const store = new Map(Object.entries(initialData));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    _getStore() {
      return store;
    },
  };
}

test("formatBytes formats byte sizes accurately", () => {
  assert.equal(formatBytes(null), "");
  assert.equal(formatBytes(0), "");
  assert.equal(formatBytes(500), "~500 B");
  assert.equal(formatBytes(1500), "~1.5 KB");
  assert.equal(formatBytes(45_000_000), "~43 MB");
  assert.equal(formatBytes(1_500_000_000), "~1.4 GB");
});

test("detectPlatform identifies known platforms and domain fallbacks", () => {
  assert.equal(detectPlatform("https://www.youtube.com/watch?v=abc"), "YouTube");
  assert.equal(detectPlatform("https://youtu.be/xyz"), "YouTube");
  assert.equal(detectPlatform("https://www.tiktok.com/@user/video/123"), "TikTok");
  assert.equal(detectPlatform("https://www.facebook.com/watch/?v=456"), "Facebook");
  assert.equal(detectPlatform("https://instagram.com/p/abc"), "Instagram");
  assert.equal(detectPlatform("https://x.com/user/status/789"), "X");
  assert.equal(detectPlatform("https://soundcloud.com/artist/track"), "SoundCloud");
  assert.equal(detectPlatform("https://example.com/media/file.mp4"), "example.com");
  assert.equal(detectPlatform("invalid-url"), "เว็บวิดีโอ");
});

test("getHistory returns empty list when storage is empty or corrupt", () => {
  const emptyStorage = createMockStorage();
  assert.deepEqual(getHistory(emptyStorage), []);

  const corruptStorage = createMockStorage({ [HISTORY_STORAGE_KEY]: "invalid json {{{" });
  assert.deepEqual(getHistory(corruptStorage), []);
});

test("addHistoryItem saves item, preserves fields, and deduplicates by URL", () => {
  const storage = createMockStorage();
  const item1 = addHistoryItem(
    {
      title: "First Video",
      url: "https://www.youtube.com/watch?v=111",
      platform: "YouTube",
      ext: "mp4",
      filename: "First Video.mp4",
      filepath: "C:\\Downloads\\First Video.mp4",
      filesize: 10_000_000,
    },
    storage,
  );

  assert.ok(item1.id);
  assert.ok(item1.date > 0);
  assert.equal(item1.title, "First Video");

  const history1 = getHistory(storage);
  assert.equal(history1.length, 1);
  assert.equal(history1[0].url, "https://www.youtube.com/watch?v=111");

  // Re-adding the same URL updates existing entry and moves to top
  const item1Updated = addHistoryItem(
    {
      title: "First Video (Renamed)",
      url: "https://www.youtube.com/watch?v=111",
      platform: "YouTube",
      ext: "mp4",
      filename: "First Video (Renamed).mp4",
      filepath: "C:\\Downloads\\First Video (Renamed).mp4",
      filesize: 12_000_000,
    },
    storage,
  );

  const history2 = getHistory(storage);
  assert.equal(history2.length, 1, "Should not duplicate items with same URL");
  assert.equal(history2[0].title, "First Video (Renamed)");
  assert.equal(history2[0].filesize, 12_000_000);
  assert.equal(item1Updated.title, "First Video (Renamed)");
});

test("addHistoryItem enforces LRU limit", () => {
  const storage = createMockStorage();
  for (let i = 0; i < MAX_HISTORY + 10; i++) {
    addHistoryItem(
      {
        title: `Item ${i}`,
        url: `https://example.com/video/${i}`,
        platform: "example.com",
        ext: "mp4",
      },
      storage,
    );
  }

  const history = getHistory(storage);
  assert.equal(history.length, MAX_HISTORY);
  // Most recent should be Item MAX_HISTORY + 9
  assert.equal(history[0].title, `Item ${MAX_HISTORY + 9}`);
  // Oldest item should be Item 10
  assert.equal(history[history.length - 1].title, "Item 10");
});

test("removeHistoryItem removes item by date or id", () => {
  const storage = createMockStorage();
  const item1 = addHistoryItem(
    {
      title: "Item 1",
      url: "https://example.com/1",
      platform: "example.com",
      ext: "mp4",
      date: 1000,
    },
    storage,
  );

  const item2 = addHistoryItem(
    {
      title: "Item 2",
      url: "https://example.com/2",
      platform: "example.com",
      ext: "mp4",
      date: 2000,
    },
    storage,
  );

  assert.equal(getHistory(storage).length, 2);

  // Remove by date (used by UI handleRemoveHistoryItem)
  const afterDateRemove = removeHistoryItem(1000, storage);
  assert.equal(afterDateRemove.length, 1);
  assert.equal(afterDateRemove[0].title, "Item 2");

  // Remove by id
  const afterIdRemove = removeHistoryItem(item2.id, storage);
  assert.equal(afterIdRemove.length, 0);
  assert.equal(getHistory(storage).length, 0);
});

test("clearHistory empties storage", () => {
  const storage = createMockStorage();
  addHistoryItem(
    {
      title: "Item 1",
      url: "https://example.com/1",
      platform: "example.com",
      ext: "mp4",
    },
    storage,
  );
  assert.equal(getHistory(storage).length, 1);

  clearHistory(storage);
  assert.equal(getHistory(storage).length, 0);
});
