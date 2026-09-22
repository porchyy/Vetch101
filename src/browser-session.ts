export const SUPPORTED_BROWSERS = ["chrome", "edge", "brave", "firefox"] as const;

export type BrowserTarget = (typeof SUPPORTED_BROWSERS)[number];

export interface BrowserSessionConfig {
  enabled: boolean;
  target: BrowserTarget;
}

export const BROWSER_SESSION_STORAGE_KEY = "vetch101_browser_session";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isSupportedBrowser(browser: unknown): browser is BrowserTarget {
  return typeof browser === "string" && (SUPPORTED_BROWSERS as readonly string[]).includes(browser);
}

export function isDirectStreamUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    const pathname = parsed.pathname.toLowerCase();
    return pathname.endsWith(".m3u8") || pathname.endsWith(".mpd");
  } catch {
    return false;
  }
}

export function synthesizeStreamTitle(url: string, date: Date = new Date()): string {
  try {
    const parsed = new URL(url.trim());
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1]?.toLowerCase() || "";
    
    // Check if the previous segment is a meaningful title (e.g. /episodes/some-slug/index.m3u8)
    if (pathParts.length >= 2) {
      const parent = pathParts[pathParts.length - 2];
      const genericNames = ["live", "hls", "dash", "video", "master", "index", "stream", "playlist"];
      if (parent && !genericNames.includes(parent.toLowerCase()) && !parent.match(/^\d+$/)) {
        return parent;
      }
    }

    if (!["index.m3u8", "master.m3u8", "playlist.m3u8", "manifest.mpd", "live.m3u8"].includes(lastPart)) {
      const stem = lastPart.replace(/\.(m3u8|mpd)$/i, "");
      if (stem && stem.length > 2 && !["index", "master", "playlist", "manifest", "live"].includes(stem)) {
        return stem;
      }
    }
  } catch {
    // Fall back to date formatting below
  }

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `Stream_${y}${m}${d}_${hh}${mm}${ss}`;
}

export function loadBrowserSessionConfig(
  storage: StorageLike = typeof window !== "undefined" ? window.localStorage : { getItem: () => null, setItem: () => {} }
): BrowserSessionConfig {
  try {
    const raw = storage.getItem(BROWSER_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        const enabled = Boolean(parsed.enabled);
        const target = isSupportedBrowser(parsed.target) ? parsed.target : "chrome";
        return { enabled, target };
      }
    }
  } catch {
    // Ignore error and fall back to default
  }
  return { enabled: false, target: "chrome" };
}

export function saveBrowserSessionConfig(
  config: BrowserSessionConfig,
  storage: StorageLike = typeof window !== "undefined" ? window.localStorage : { getItem: () => null, setItem: () => {} }
): void {
  try {
    storage.setItem(BROWSER_SESSION_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota or access errors
  }
}

export function isAntiBotChallengeError(errorText: string | null | undefined): boolean {
  if (!errorText || typeof errorText !== "string") return false;
  const lower = errorText.toLowerCase();
  return (
    (lower.includes("403") && (lower.includes("cloudflare") || lower.includes("anti-bot") || lower.includes("forbidden") || lower.includes("challenge"))) ||
    lower.includes("cloudflare anti-bot") ||
    lower.includes("cloudflare turnstile") ||
    lower.includes("anti-bot challenge")
  );
}
