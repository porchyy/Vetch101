import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parseVideoUrl } from "./video-url.ts";
import {
  AlertCircle,
  ArrowDown,
  ArrowUpRight,
  Check,
  Clipboard,
  Clock3,
  Copy,
  FileAudio,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Moon,
  PawPrint,
  Play,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  X,
  Globe,
  RotateCcw,
} from "lucide-react";
import { formatBytes } from "./history.ts";
import { UpdateBanner } from "./components/UpdateBanner";
import { MediaResultCard } from "./components/MediaResultCard";
import { PixelCat } from "./components/PixelCat";
import {
  resolveInitialTheme,
  getNextTheme,
  applyThemeToDom,
  saveThemeToStorage,
  loadSavedTheme,
  type Theme,
} from "./theme-manager.ts";
import {
  deriveMascotMood,
  loadSavedMascotVisibility,
  saveMascotVisibility,
  toggleMascotVisibility,
} from "./mascot-state.ts";
import {
  loadBrowserSessionConfig,
  saveBrowserSessionConfig,
  type BrowserTarget,
  isAntiBotChallengeError,
} from "./browser-session.ts";
import { createUpdaterState, UpdaterAction, canStartUpdate, type UpdaterState } from "./updater-state";
import { useDownloadSession } from "./useDownloadSession";
import type { DependencyStatus } from "./models.ts";

const FOLDER_STORAGE_KEY = "vetch101_download_dir";

export default function App() {
  const [folder, setFolder] = useState<string>(() => {
    return localStorage.getItem(FOLDER_STORAGE_KEY) || "";
  });

  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [checkingDeps, setCheckingDeps] = useState(true);
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const updateLock = useRef(false);

  // App updater state & actions
  const [updaterState, setUpdaterState] = useState<UpdaterState>(createUpdaterState());

  // Visual Theme State
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = loadSavedTheme();
    const systemPrefersDark =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial = resolveInitialTheme(stored, !!systemPrefersDark);
    applyThemeToDom(initial);
    return initial;
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = getNextTheme(prev);
      applyThemeToDom(next);
      saveThemeToStorage(next);
      return next;
    });
  };

  // Pixel Cat Mascot State
  const [mascotVisible, setMascotVisible] = useState<boolean>(() => {
    return loadSavedMascotVisibility();
  });

  const handleToggleMascot = () => {
    setMascotVisible((prev) => {
      const next = toggleMascotVisibility(prev);
      saveMascotVisibility(next);
      return next;
    });
  };

  // Browser Session Handoff State
  const [browserSession, setBrowserSession] = useState(() => loadBrowserSessionConfig());

  const handleToggleBrowserSession = () => {
    setBrowserSession((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      saveBrowserSessionConfig(next);
      return next;
    });
  };

  const handleChangeBrowserTarget = (target: BrowserTarget) => {
    setBrowserSession((prev) => {
      const next = { ...prev, target };
      saveBrowserSessionConfig(next);
      return next;
    });
  };

  const [recentSuccess, setRecentSuccess] = useState(false);

  const session = useDownloadSession({
    folder,
    isBlocked: updatingYtdlp || updateLock.current || updaterState.status === "applying",
    inputRef,
    browser: browserSession.enabled ? browserSession.target : null,
  });

  useEffect(() => {
    if (session.status === "completed" || (session.status === "ready" && session.meta)) {
      setRecentSuccess(true);
      const timer = window.setTimeout(() => setRecentSuccess(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [session.status, session.meta]);

  const mascotMood = deriveMascotMood({
    isDownloading: session.isDownloading,
    isInspecting: session.isInspecting,
    hasError: !!session.error,
    recentSuccess,
  });

  const { setError, setNotice } = session;

  // 1. Initial dependency check and default directory resolution
  const refreshDependencies = useCallback(async () => {
    setCheckingDeps(true);
    try {
      const depStatus = await invoke<DependencyStatus>("check_dependencies");
      setDeps(depStatus);

      if (!folder) {
        const defaultDir = await invoke<string>("get_default_download_dir");
        setFolder(defaultDir);
        localStorage.setItem(FOLDER_STORAGE_KEY, defaultDir);
      }
    } catch (e) {
      setError({
        summary: "ไม่สามารถตรวจสอบโปรแกรม yt-dlp หรือ FFmpeg ในเครื่องได้",
        detail: String(e),
      });
    } finally {
      setCheckingDeps(false);
    }
  }, [folder, setError]);

  useEffect(() => {
    void refreshDependencies();
  }, [refreshDependencies]);

  // Update yt-dlp binary
  const engineChecked = useRef(false);
  const appUpdateLock = useRef(false);
  const appChecked = useRef(false);

  const handleUpdateYtdlp = async (background = false) => {
    if (session.downloadLockActive || session.isDownloading || updateLock.current || session.isInspecting) return;
    updateLock.current = !background;
    if (!background) setUpdatingYtdlp(true);
    setUpdateMsg(null);
    if (!background) session.setError(null);
    try {
      const resultMsg = await invoke<string>("update_ytdlp", { background });
      if (!background) setUpdateMsg(resultMsg);
      setDeps(await invoke<DependencyStatus>("check_dependencies"));
    } catch (e) {
      if (!background) session.setError({
        summary: "การอัปเดต yt-dlp ไม่สำเร็จ",
        detail: String(e),
      });
    } finally {
      if (!background) {
        updateLock.current = false;
        setUpdatingYtdlp(false);
      }
    }
  };

  useEffect(() => {
    if (checkingDeps || !deps?.ytdlp_available || engineChecked.current || session.isDownloading || session.isInspecting || updateLock.current) return;
    engineChecked.current = true;
    void handleUpdateYtdlp(true);
  }, [checkingDeps, deps, session.isDownloading, session.isInspecting]);

  const handleCheckAppUpdate = useCallback(async (manual: boolean = false) => {
    if (appUpdateLock.current) return;
    appUpdateLock.current = true;
    setUpdaterState(UpdaterAction.check);
    try {
      const info = await invoke<{
        available: boolean;
        current_version: string;
        latest_version: string;
        release_notes: string;
        setup_url?: string;
        portable_url?: string;
        is_installed: boolean;
      }>("check_app_update");

      if (info.available) {
        let dismissed: string | null = null;
        try { dismissed = localStorage.getItem("vetch101_dismissed_update"); } catch {}
        if (!manual && dismissed === info.latest_version) {
          setUpdaterState(createUpdaterState());
          return;
        }
        setUpdaterState(
          UpdaterAction.available(createUpdaterState(), {
            version: info.latest_version,
            notes: info.release_notes,
            setupUrl: info.setup_url,
            portableUrl: info.portable_url,
            isInstalled: info.is_installed,
          })
        );
      } else {
        setUpdaterState(createUpdaterState());
        if (manual) {
          setNotice(`คุณกำลังใช้งานเวอร์ชันล่าสุดแล้ว (${info.current_version})`);
        }
      }
    } catch (e) {
      setUpdaterState(createUpdaterState());
      if (manual) {
        setNotice(`ไม่สามารถตรวจหาอัปเดตได้: ${String(e)}`);
      }
    } finally {
      appUpdateLock.current = false;
    }
  }, [setNotice]);

  useEffect(() => {
    if (checkingDeps || !deps || appChecked.current) return;
    const timer = setTimeout(() => {
      appChecked.current = true;
      void handleCheckAppUpdate(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [handleCheckAppUpdate, checkingDeps, deps]);

  useEffect(() => {
    const unlisten = listen<{ downloaded: number; total: number; percentage: number }>(
      "update-progress",
      (event) => {
        const { percentage, downloaded, total } = event.payload;
        setUpdaterState((prev) => UpdaterAction.progress(prev, percentage, downloaded, total));
      }
    );
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (
      updaterState.status !== "available" ||
      appUpdateLock.current ||
      updateLock.current ||
      updatingYtdlp ||
      session.isDownloading ||
      session.isInspecting ||
      session.downloadLockActive
    ) {
      return;
    }
    appUpdateLock.current = true;
    setUpdaterState(UpdaterAction.startDownload);
    void invoke("stage_app_update")
      .then(() => {
        setUpdaterState(UpdaterAction.ready);
      })
      .catch((e: unknown) => {
        setUpdaterState((state) => UpdaterAction.error(state, String(e)));
      })
      .finally(() => {
        appUpdateLock.current = false;
      });
  }, [
    updaterState.status,
    updatingYtdlp,
    session.isDownloading,
    session.isInspecting,
    session.downloadLockActive,
  ]);

  const handleStartAppUpdate = async () => {
    const check = canStartUpdate({
      isDownloading: session.isDownloading || session.downloadLockActive || updateLock.current,
      isInspecting: session.isInspecting,
    });
    if (!check.allowed) {
      session.setNotice(check.reason || "ไม่สามารถอัปเดตได้ในขณะนี้");
      return;
    }
    if (updaterState.status !== "ready" || appUpdateLock.current) return;
    appUpdateLock.current = true;
    updateLock.current = true;
    setUpdaterState(UpdaterAction.apply);
    try {
      await invoke("install_app_update");
    } catch (e) {
      setUpdaterState(UpdaterAction.error(updaterState, String(e)));
    } finally {
      appUpdateLock.current = false;
      updateLock.current = false;
    }
  };

  const handleDismissAppUpdate = () => {
    if ("version" in updaterState && updaterState.version) {
      try {
        localStorage.setItem("vetch101_dismissed_update", updaterState.version);
      } catch {}
    }
    setUpdaterState(UpdaterAction.dismiss(updaterState));
  };

  // Destination folder management
  const handleSelectFolder = async () => {
    if (session.isDownloading) return;
    try {
      const chosen = await invoke<string | null>("select_folder", {
        defaultDir: folder || undefined,
      });
      if (chosen) {
        setFolder(chosen);
        localStorage.setItem(FOLDER_STORAGE_KEY, chosen);
      }
    } catch (e) {
      session.setError({
        summary: "ไม่สามารถเลือกโฟลเดอร์ได้",
        detail: String(e),
      });
    }
  };

  const handleOpenFolder = async () => {
    if (!folder) return;
    try {
      await invoke("open_folder", { path: folder });
    } catch (e) {
      session.setError({
        summary: "ไม่สามารถเปิดโฟลเดอร์ปลายทางได้",
        detail: String(e),
      });
    }
  };

  return (
    <div
      className="app-shell"
      onDragOver={(e) => {
        e.preventDefault();
        const types = e.dataTransfer.types;
        e.dataTransfer.dropEffect =
          !session.downloadLockActive &&
          !session.isInspecting &&
          !types.includes("Files") &&
          (types.includes("text/uri-list") || types.includes("text/plain"))
            ? "copy"
            : "none";
      }}
      onDrop={session.handleDrop}
    >
      {/* Header bar */}
      <header className="app-header">
        <div className="header-left">
          <div className="brand">
            <span className="brand-badge">
              <ArrowDown size={18} />
            </span>
            <span className="brand-title">
              vetch<strong>101</strong>
            </span>
            <span className="edition-badge">Desktop</span>
          </div>
        </div>

        <div className="header-right">
          {checkingDeps ? (
            <span className="status-pill status-loading">
              <LoaderCircle size={13} className="spin" />
              กำลังตรวจเครื่องมือ
            </span>
          ) : deps?.ytdlp_available ? (
            <div className="tool-status-group">
              <span className="status-pill status-ready" title={`yt-dlp: ${deps.ytdlp_version || "พร้อมใช้งาน"}`}>
                <span className="dot dot-ready" />
                พร้อมใช้งาน {deps.ytdlp_version ? `(${deps.ytdlp_version})` : ""}
              </span>
              <button
                className="button-icon-subtle"
                onClick={() => void handleUpdateYtdlp()}
                disabled={updatingYtdlp || session.isDownloading || session.isInspecting || updaterState.status === "applying"}
                title="ตรวจสอบและอัปเดต yt-dlp เป็นเวอร์ชันล่าสุด"
              >
                <RefreshCw size={13} className={updatingYtdlp ? "spin" : ""} />
                {updatingYtdlp ? "กำลังอัปเดต" : "อัปเดต yt-dlp"}
              </button>
              <button
                className="button-icon-subtle"
                onClick={() => handleCheckAppUpdate(true)}
                disabled={updaterState.status === "checking" || updaterState.status === "downloading" || updaterState.status === "applying"}
                title="ตรวจหาอัปเดตแอป Vetch101"
              >
                <Sparkles size={13} className={updaterState.status === "checking" ? "spin" : ""} />
                {updaterState.status === "checking" ? "กำลังตรวจแอป" : "ตรวจอัปเดตแอป"}
              </button>
            </div>
          ) : (
            <span className="status-pill status-warning" title="ไม่พบโปรแกรม yt-dlp หรือ FFmpeg ในเครื่อง">
              <span className="dot dot-warning" />
              ไม่พบเครื่องมือดาวน์โหลด
            </span>
          )}

          {/* Header Controls: Mascot and Theme */}
          <div className="header-actions">
            <button
              type="button"
              className={`button-icon-subtle ${mascotVisible ? "active" : ""}`}
              onClick={handleToggleMascot}
              title={mascotVisible ? "ซ่อนน้องแมวมาสคอต" : "แสดงน้องแมวมาสคอต"}
              aria-label="เปิดหรือปิดมาสคอตน้องแมว"
            >
              <PawPrint size={14} />
            </button>
            <button
              type="button"
              className="button-icon-subtle"
              onClick={toggleTheme}
              title={theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง (Light Mode)" : "เปลี่ยนเป็นโหมดมืด (Dark Mode)"}
              aria-label="สลับโหมดสี ดำ-ขาว"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main workspace */}
      <main className="main-content">
        <UpdateBanner
          state={updaterState}
          isDownloading={session.isDownloading || session.downloadLockActive || updatingYtdlp}
          isInspecting={session.isInspecting}
          onStartUpdate={handleStartAppUpdate}
          onDismiss={handleDismissAppUpdate}
        />

        {updateMsg && (
          <div className="alert alert-info">
            <Check size={16} />
            <span>{updateMsg}</span>
            <button className="close-btn" onClick={() => setUpdateMsg(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input Card */}
        <section className="card input-card">
          <label htmlFor="video-url" className="field-label">
            <Link2 size={16} />
            ลิงก์วิดีโอที่ต้องการดาวน์โหลด
          </label>

          <div className="input-group">
            <input
              id="video-url"
              ref={inputRef}
              type="text"
              className="url-input"
              placeholder="วางหรือลากลิงก์วิดีโอหรือรูปภาพมาที่นี่"
              value={session.url}
              onChange={(e) => {
                const nextVal = e.target.value;
                session.changeUrl(nextVal);
                let valid = false;
                try { parseVideoUrl(nextVal.trim()); valid = true; } catch {}
                if (valid) {
                  session.scheduleInspect(nextVal.trim(), 800);
                }
              }}
              onPaste={session.handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && session.url.trim() && !session.isDownloading && !session.isInspecting) {
                  e.preventDefault();
                  void session.inspectUrl();
                }
              }}
              disabled={session.isDownloading}
              autoComplete="off"
              spellCheck={false}
            />

            {session.url ? (
              <button
                type="button"
                className="action-icon-btn"
                onClick={session.handleClear}
                disabled={session.isDownloading}
                title="ล้างลิงก์"
              >
                <X size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="action-text-btn"
                onClick={session.handlePasteClipboard}
                title="วางจากคลิปบอร์ด"
              >
                <Clipboard size={14} />
                วางลิงก์
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              disabled={updatingYtdlp || session.isDownloading || session.isInspecting || !session.url.trim()}
              onClick={() => session.inspectUrl()}
            >
              {session.isInspecting ? (
                <>
                  <LoaderCircle size={16} className="spin" />
                  กำลังตรวจสอบ…
                </>
              ) : (
                <>
                  ตรวจสอบลิงก์
                  <ArrowUpRight size={16} />
                </>
              )}
            </button>
          </div>

          <div className="platform-hints">
            <span className="hint-title">รองรับ:</span>
            <span className="hint-tag">YouTube</span>
            <span className="hint-tag">TikTok</span>
            <span className="hint-tag">Facebook</span>
            <span className="hint-tag">Instagram</span>
            <span className="hint-tag">X</span>
            <span className="hint-tag">SoundCloud</span>
            <span className="hint-tag">HLS/m3u8</span>
          </div>

          {/* Browser Session Handoff Controls */}
          <div className="browser-session-bar" role="region" aria-label="การตั้งค่า Cookies จากเบราว์เซอร์">
            <label className="browser-session-toggle">
              <input
                type="checkbox"
                checked={browserSession.enabled}
                onChange={handleToggleBrowserSession}
                disabled={session.isDownloading || session.isInspecting}
              />
              <span className="browser-toggle-label">
                <Globe size={14} />
                ใช้ Cookies จากเบราว์เซอร์
              </span>
            </label>

            {browserSession.enabled && (
              <div className="browser-target-selector">
                <span className="browser-target-prefix">จาก:</span>
                <select
                  value={browserSession.target}
                  onChange={(e) => handleChangeBrowserTarget(e.target.value as BrowserTarget)}
                  disabled={session.isDownloading || session.isInspecting}
                  className="browser-select"
                  aria-label="เลือกเบราว์เซอร์เป้าหมาย"
                >
                  <option value="chrome">Google Chrome</option>
                  <option value="edge">Microsoft Edge</option>
                  <option value="brave">Brave</option>
                  <option value="firefox">Mozilla Firefox</option>
                </select>
              </div>
            )}

            <span className="browser-session-hint">
              (แก้ Cloudflare 403 / คลิปจำกัดอายุ)
            </span>
          </div>
        </section>

        {/* Error notification with expandable technical details */}
        {session.error && (
          <div className="alert alert-error" role="alert">
            <div className="alert-header">
              <AlertCircle size={18} />
              <div className="alert-text">
                <strong>{session.error.summary}</strong>
              </div>
              <button
                className="button-icon-subtle"
                onClick={() => session.setError(null)}
                title="ปิดการแจ้งเตือน"
              >
                <X size={14} />
              </button>
            </div>
            {session.error.detail && (
              <details className="alert-details">
                <summary>รายละเอียดทางเทคนิค</summary>
                <pre>{session.error.detail}</pre>
              </details>
            )}
            {isAntiBotChallengeError(session.error.detail) && !browserSession.enabled && (
              <div className="alert-retry-row">
                <button
                  type="button"
                  className="btn btn-sm btn-retry-cookies"
                  onClick={() => {
                    const next = { ...browserSession, enabled: true };
                    setBrowserSession(next);
                    saveBrowserSessionConfig(next);
                    void session.inspectUrl(session.url, next.target);
                  }}
                >
                  <RotateCcw size={13} />
                  ลองใหม่อีกครั้งด้วย Cookies จาก {browserSession.target === "chrome" ? "Chrome" : browserSession.target === "edge" ? "Edge" : browserSession.target.toUpperCase()}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notice notification */}
        {session.notice && (
          <div className="alert alert-success" role="status">
            <Check size={16} />
            <span>{session.notice}</span>
          </div>
        )}

        {/* Result card — composite shell with swappable media details */}
        {session.mediaConfig && (
          <MediaResultCard
            media={session.mediaConfig}
            folder={{
              path: folder,
              onSelect: handleSelectFolder,
              onOpen: handleOpenFolder,
            }}
            session={session.sessionConfig}
            actions={session.actionConfig}
          />
        )}

        {/* History section */}
        <section className="card history-card">
          <div className="history-header">
            <div className="history-title">
              <Clock3 size={17} />
              <span>ประวัติการดาวน์โหลดในเครื่อง</span>
              {session.recent.length > 0 && <span className="history-count">({session.recent.length})</span>}
            </div>
            {session.recent.length > 0 && (
              <button
                type="button"
                className="button-icon-subtle"
                onClick={session.clearAllHistory}
                title="ล้างประวัติทั้งหมด"
              >
                <Trash2 size={14} />
                ล้างประวัติ
              </button>
            )}
          </div>

          {session.recent.length > 0 ? (
            <div className="history-list">
              {session.recent.map((item) => (
                <div key={`${item.url}-${item.date}`} className="history-item">
                  <div className="history-icon">
                    {item.ext === "mp3" || item.ext === "wav" ? (
                      <FileAudio size={18} />
                    ) : item.ext === "jpg" || item.ext === "png" ? (
                      <ImageIcon size={18} />
                    ) : (
                      <Film size={18} />
                    )}
                  </div>
                  <div className="history-info">
                    <span className="history-item-title" title={item.title}>
                      {item.title}
                    </span>
                    <span className="history-meta">
                      {item.platform} · {item.ext.toUpperCase()} ·{" "}
                      {item.filesize ? `${formatBytes(item.filesize)} · ` : ""}
                      {new Date(item.date).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="history-actions">
                    {item.filepath && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => session.handleOpenFile(item.filepath)}
                        title="เปิดไฟล์ด้วยโปรแกรมเริ่มต้น"
                      >
                        <Play size={13} />
                        เปิดไฟล์
                      </button>
                    )}
                    {item.filepath && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => session.handleRevealFolder(item.filepath)}
                        title="เปิดโฟลเดอร์และชี้ตำแหน่งไฟล์ในเครื่อง"
                      >
                        <FolderOpen size={13} />
                        โฟลเดอร์
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => session.handleCopyLink(item.url)}
                      title="คัดลอกลิงก์ต้นทาง"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={session.isDownloading}
                      onClick={() => {
                        void session.inspectUrl(item.url);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      title="โหลดลิงก์นี้อีกครั้ง"
                    >
                      <RefreshCw size={13} />
                      โหลดซ้ำ
                    </button>
                    <button
                      type="button"
                      className="button-icon-subtle"
                      onClick={() => session.removeHistory(item.date)}
                      title="ลบรายการนี้ออกจากประวัติ"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="history-empty">
              <p>ยังไม่มีประวัติการดาวน์โหลด ไฟล์ที่ดาวน์โหลดสำเร็จจะบันทึกไว้ในเครื่องนี้เท่านั้น</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span>Vetch101 · แอปดาวน์โหลดวิดีโอและเสียงสำหรับใช้งานส่วนตัว</span>
      </footer>

      {/* Floating Pixel Cat Companion */}
      <PixelCat mood={mascotMood} visible={mascotVisible} />
    </div>
  );
}
