import assert from "node:assert/strict";
import test from "node:test";
import {
  isDirectStreamUrl,
  synthesizeStreamTitle,
  SUPPORTED_BROWSERS,
  isSupportedBrowser,
  loadBrowserSessionConfig,
  saveBrowserSessionConfig,
  isAntiBotChallengeError,
  BROWSER_SESSION_STORAGE_KEY,
} from "../src/browser-session.ts";

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
  };
}

test("isDirectStreamUrl accurately detects .m3u8 and .mpd stream manifests", () => {
  assert.equal(isDirectStreamUrl("https://example.com/video/master.m3u8"), true);
  assert.equal(isDirectStreamUrl("https://example.com/live/playlist.m3u8?token=xyz123"), true);
  assert.equal(isDirectStreamUrl("https://example.com/stream/manifest.mpd"), true);
  assert.equal(isDirectStreamUrl("https://example.com/stream/manifest.mpd?sign=abc#frag"), true);

  // Non-direct stream URLs
  assert.equal(isDirectStreamUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), false);
  assert.equal(isDirectStreamUrl("https://www.tiktok.com/@user/video/1234567890"), false);
  assert.equal(isDirectStreamUrl("https://example.com/m3u8-discussion/page.html"), false);
  assert.equal(isDirectStreamUrl(""), false);
  assert.equal(isDirectStreamUrl(null), false);
});

test("synthesizeStreamTitle generates formatted timestamped title or clean path fallback", () => {
  const fixedDate = new Date("2026-09-22T08:30:15Z");
  const title = synthesizeStreamTitle("https://cdn.example.com/hls/live.m3u8?auth=123", fixedDate);
  assert.equal(title.startsWith("Stream_"), true);
  assert.match(title, /^Stream_\d{8}_\d{6}$/);

  // If URL has a clean descriptive slug before manifest
  const namedTitle = synthesizeStreamTitle("https://cdn.example.com/episodes/game-of-thrones-s01e01/index.m3u8", fixedDate);
  assert.equal(namedTitle, "game-of-thrones-s01e01");
});

test("SUPPORTED_BROWSERS includes expected modern browsers and validates targets", () => {
  assert.deepEqual(SUPPORTED_BROWSERS, ["chrome", "edge", "brave", "firefox"]);
  assert.equal(isSupportedBrowser("chrome"), true);
  assert.equal(isSupportedBrowser("edge"), true);
  assert.equal(isSupportedBrowser("brave"), true);
  assert.equal(isSupportedBrowser("firefox"), true);
  assert.equal(isSupportedBrowser("safari"), false);
  assert.equal(isSupportedBrowser("opera"), false);
  assert.equal(isSupportedBrowser(""), false);
});

test("loadBrowserSessionConfig and saveBrowserSessionConfig persist choices correctly", () => {
  const mockStorage = createMockStorage();

  // Default when empty
  const defaultConfig = loadBrowserSessionConfig(mockStorage);
  assert.equal(defaultConfig.enabled, false);
  assert.equal(defaultConfig.target, "chrome");

  // Save new config
  saveBrowserSessionConfig({ enabled: true, target: "edge" }, mockStorage);
  const reloaded = loadBrowserSessionConfig(mockStorage);
  assert.equal(reloaded.enabled, true);
  assert.equal(reloaded.target, "edge");

  // Handles corrupted JSON gracefully
  mockStorage.setItem(BROWSER_SESSION_STORAGE_KEY, "invalid json");
  const fallback = loadBrowserSessionConfig(mockStorage);
  assert.equal(fallback.enabled, false);
  assert.equal(fallback.target, "chrome");
});

test("isAntiBotChallengeError identifies Cloudflare and 403 challenge signatures", () => {
  assert.equal(
    isAntiBotChallengeError("yt-dlp: ERROR: [generic] Got HTTP Error 403 caused by Cloudflare anti-bot challenge; try again"),
    true
  );
  assert.equal(
    isAntiBotChallengeError("HTTP Error 403: Forbidden - Just a moment... Cloudflare Turnstile"),
    true
  );
  assert.equal(
    isAntiBotChallengeError("ERROR: [generic] Unable to download webpage: HTTP Error 403: Forbidden"),
    true
  );
  assert.equal(
    isAntiBotChallengeError("Cloudflare anti-bot verification required"),
    true
  );

  // Non-anti-bot errors
  assert.equal(isAntiBotChallengeError("Network timeout: connection refused"), false);
  assert.equal(isAntiBotChallengeError("Video unavailable: Private video"), false);
  assert.equal(isAntiBotChallengeError(""), false);
  assert.equal(isAntiBotChallengeError(null), false);
});
