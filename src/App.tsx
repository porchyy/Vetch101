import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parseVideoUrl } from "./video-url";
import {
  AlertCircle,
  ArrowDown,
  ArrowUpRight,
  Check,
  Clipboard,
  Clock3,
  FileAudio,
  Film,
  FolderOpen,
  Link2,
  LoaderCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

interface QualityOption {
  id: string;
  label: string;
  ext: string;
  format_spec: string;
}

interface VideoMetadata {
  id: string;
  title: string;
  thumbnail: string;
  duration?: number;
  channel?: string;
  qualities: QualityOption[];
}

interface DownloadProgressPayload {
  progress: number;
  speed: string;
  eta: string;
  status: string;
  message: string;
  filename?: string;
}

interface DependencyStatus {
  ytdlp_available: boolean;
  ffmpeg_available: boolean;
  ffprobe_available: boolean;
  ytdlp_path: string | null;
  ffmpeg_path: string | null;
  ffprobe_path: string | null;
  ytdlp_version: string | null;
  app_bin_dir: string;
}

interface RecentItem {
  id: string;
  title: string;
  url: string;
  platform: string;
  ext: string;
  date: number;
  filename?: string;
}

interface AppError {
  summary: string;
  detail?: string;
}

const HISTORY_STORAGE_KEY = "vetch101_history_v3";
const FOLDER_STORAGE_KEY = "vetch101_download_dir";

function detectPlatform(urlStr: string): string {
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

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}:${String(rm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function App() {
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<VideoMetadata | null>(null);
  const [selectedQualityId, setSelectedQualityId] = useState("");
  const [folder, setFolder] = useState<string>(() => {
    return localStorage.getItem(FOLDER_STORAGE_KEY) || "";
  });

  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "downloading" | "completed">("idle");
  const [progress, setProgress] = useState<DownloadProgressPayload | null>(null);
  const [savedFile, setSavedFile] = useState<string | null>(null);

  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [checkingDeps, setCheckingDeps] = useState(true);
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const [error, setError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState("");

  const [recent, setRecent] = useState<RecentItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const downloadLock = useRef(false);

  // 1. Initial dependency check and default directory resolution
  const refreshDependencies = useCallback(async () => {
    setCheckingDeps(true);
    try {
      const depStatus = await invoke<DependencyStatus>("check_dependencies");
      setDeps(depStatus);

      // If user hasn't chosen a folder yet, initialize with the system Downloads directory
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
  }, [folder]);

  useEffect(() => {
    void refreshDependencies();
  }, [refreshDependencies]);

  // 2. Listen to real-time progress events from Rust
  useEffect(() => {
    const unlisten = listen<DownloadProgressPayload>("download-progress", (event) => {
      setProgress(event.payload);
      if (event.payload.filename) {
        setSavedFile(event.payload.filename);
      }
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // Update yt-dlp binary
  const handleUpdateYtdlp = async () => {
    if (downloadLock.current || updatingYtdlp) return;
    setUpdatingYtdlp(true);
    setUpdateMsg(null);
    setError(null);
    try {
      const resultMsg = await invoke<string>("update_ytdlp");
      setUpdateMsg(resultMsg);
      await refreshDependencies();
    } catch (e) {
      setError({
        summary: "การอัปเดต yt-dlp ไม่สำเร็จ",
        detail: String(e),
      });
    } finally {
      setUpdatingYtdlp(false);
    }
  };

  // Select destination folder
  const handleSelectFolder = async () => {
    if (status === "downloading") return;
    try {
      const chosen = await invoke<string | null>("select_folder", {
        defaultDir: folder || undefined,
      });
      if (chosen) {
        setFolder(chosen);
        localStorage.setItem(FOLDER_STORAGE_KEY, chosen);
      }
    } catch (e) {
      setError({
        summary: "ไม่สามารถเลือกโฟลเดอร์ได้",
        detail: String(e),
      });
    }
  };

  // Open destination folder in Windows Explorer
  const handleOpenFolder = async () => {
    if (!folder) return;
    try {
      await invoke("open_folder", { path: folder });
    } catch (e) {
      setError({
        summary: "ไม่สามารถเปิดโฟลเดอร์ปลายทางได้",
        detail: String(e),
      });
    }
  };

  // Handle URL paste: replace previous content and trim cleanly
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").trim();
    if (!text) return;
    e.preventDefault();
    setUrl(text);
    setError(null);
    setNotice("");
    setMeta(null);
    setStatus("idle");
  };

  // Clear current input and state
  const handleClear = () => {
    if (downloadLock.current) return;
    setUrl("");
    setMeta(null);
    setStatus("idle");
    setError(null);
    setNotice("");
    setProgress(null);
    setSavedFile(null);
    inputRef.current?.focus();
  };

  // Inspect video URL
  const handleInspectUrl = async (urlToInspect?: string) => {
    if (downloadLock.current) return;
    const target = (urlToInspect ?? url).trim();

    let cleanUrl = "";
    try {
      cleanUrl = parseVideoUrl(target);
    } catch (err) {
      setError({
        summary: err instanceof Error ? err.message : String(err),
      });
      inputRef.current?.focus();
      return;
    }

    setUrl(cleanUrl);
    setStatus("checking");
    setError(null);
    setNotice("");
    setMeta(null);
    setProgress(null);
    setSavedFile(null);

    try {
      const metadata = await invoke<VideoMetadata>("fetch_metadata", { url: cleanUrl });
      setMeta(metadata);
      if (metadata.qualities.length > 0) {
        setSelectedQualityId(metadata.qualities[0].id);
      }
      setStatus("ready");
    } catch (err) {
      const raw = String(err);
      setStatus("idle");
      setError({
        summary: "ไม่สามารถดึงข้อมูลวิดีโอจากลิงก์นี้ได้",
        detail: raw,
      });
    }
  };

  // Start download
  const handleStartDownload = async () => {
    if (!meta || downloadLock.current || status === "downloading") return;
    const selected = meta.qualities.find((q) => q.id === selectedQualityId);
    if (!selected) {
      setError({ summary: "กรุณาเลือกความละเอียดหรือรูปแบบไฟล์ที่ต้องการ" });
      return;
    }

    if (!folder) {
      setError({ summary: "กรุณาเลือกโฟลเดอร์สำหรับบันทึกไฟล์" });
      return;
    }

    downloadLock.current = true;
    setStatus("downloading");
    setError(null);
    setNotice("");
    setProgress(null);
    setSavedFile(null);

    try {
      await invoke("start_download", {
        url,
        formatSpec: selected.format_spec,
        downloadDir: folder,
      });

      setStatus("completed");
      setNotice("บันทึกไฟล์เรียบร้อยแล้ว");

      // Save to local history
      const item: RecentItem = {
        id: meta.id || String(Date.now()),
        title: meta.title,
        url,
        platform: detectPlatform(url),
        ext: selected.ext,
        date: Date.now(),
        filename: savedFile || `${meta.title}.${selected.ext}`,
      };

      setRecent((prev) => {
        const next = [item, ...prev.filter((x) => x.url !== url)].slice(0, 10);
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch (err) {
      setStatus("ready");
      const errStr = String(err);
      if (errStr.includes("ยกเลิก")) {
        setNotice("ยกเลิกการดาวน์โหลดแล้ว");
      } else {
        setError({
          summary: "ดาวน์โหลดไม่สำเร็จ",
          detail: errStr,
        });
      }
    } finally {
      downloadLock.current = false;
    }
  };

  // Cancel running download
  const handleCancelDownload = async () => {
    if (status !== "downloading") return;
    try {
      await invoke("cancel_download");
      setNotice("ส่งคำสั่งยกเลิกแล้ว");
    } catch (e) {
      setError({
        summary: "ไม่สามารถยกเลิกงานได้",
        detail: String(e),
      });
    }
  };

  const selectedQuality = meta?.qualities.find((q) => q.id === selectedQualityId);

  return (
    <div className="app-shell">
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
                onClick={handleUpdateYtdlp}
                disabled={updatingYtdlp || status === "downloading"}
                title="ตรวจสอบและอัปเดต yt-dlp เป็นเวอร์ชันล่าสุด"
              >
                <RefreshCw size={13} className={updatingYtdlp ? "spin" : ""} />
                {updatingYtdlp ? "กำลังอัปเดต" : "อัปเดต yt-dlp"}
              </button>
            </div>
          ) : (
            <span className="status-pill status-warning" title="ไม่พบโปรแกรม yt-dlp หรือ FFmpeg ในเครื่อง">
              <span className="dot dot-warning" />
              ไม่พบเครื่องมือดาวน์โหลด
            </span>
          )}
        </div>
      </header>

      {/* Main workspace */}
      <main className="main-content">
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
              placeholder="วางลิงก์ เช่น https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim() && status !== "downloading" && status !== "checking") {
                  e.preventDefault();
                  void handleInspectUrl();
                }
              }}
              disabled={status === "downloading"}
              autoComplete="off"
              spellCheck={false}
            />

            {url ? (
              <button
                type="button"
                className="action-icon-btn"
                onClick={handleClear}
                disabled={status === "downloading"}
                title="ล้างลิงก์"
              >
                <X size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="action-text-btn"
                onClick={async () => {
                  try {
                    const clipboardText = await navigator.clipboard.readText();
                    if (clipboardText) {
                      setUrl(clipboardText.trim());
                      inputRef.current?.focus();
                    }
                  } catch {
                    setNotice("กรุณากด Ctrl+V เพื่อวางลิงก์");
                  }
                }}
                title="วางจากคลิปบอร์ด"
              >
                <Clipboard size={14} />
                วางลิงก์
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              disabled={status === "downloading" || status === "checking" || !url.trim()}
              onClick={() => handleInspectUrl()}
            >
              {status === "checking" ? (
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
          </div>
        </section>

        {/* Error notification with expandable technical details */}
        {error && (
          <div className="alert alert-error" role="alert">
            <div className="alert-header">
              <AlertCircle size={18} />
              <div className="alert-text">
                <strong>{error.summary}</strong>
              </div>
            </div>
            {error.detail && (
              <details className="tech-details">
                <summary>ดูรายละเอียดข้อผิดพลาดทางเทคนิค</summary>
                <pre>{error.detail}</pre>
              </details>
            )}
          </div>
        )}

        {/* Notice notification */}
        {notice && (
          <div className="alert alert-success" role="status">
            <Check size={16} />
            <span>{notice}</span>
          </div>
        )}

        {/* Video Preview and Quality Selection */}
        {meta && (
          <section className="card result-card">
            <div className="video-summary">
              <div className="thumbnail-wrapper">
                {meta.thumbnail ? (
                  <img
                    src={meta.thumbnail}
                    alt={meta.title}
                    className="thumbnail-img"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="thumbnail-placeholder">
                    <Film size={36} />
                  </div>
                )}
                {meta.duration && meta.duration > 0 && (
                  <span className="duration-tag">{formatDuration(meta.duration)}</span>
                )}
              </div>

              <div className="video-info">
                <div className="video-channel">
                  <span className="platform-badge">{detectPlatform(url)}</span>
                  {meta.channel && <span className="channel-name">{meta.channel}</span>}
                </div>
                <h2 className="video-title">{meta.title}</h2>
              </div>
            </div>

            {/* Quality selection grid */}
            <div className="quality-section">
              <span className="section-title">เลือกรูปแบบไฟล์ที่ต้องการ:</span>
              <div className="quality-grid">
                {meta.qualities.map((q) => {
                  const isSelected = selectedQualityId === q.id;
                  const isAudio = q.ext === "mp3";
                  return (
                    <label
                      key={q.id}
                      className={`quality-card ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        if (status !== "downloading") setSelectedQualityId(q.id);
                      }}
                    >
                      <input
                        type="radio"
                        name="quality"
                        value={q.id}
                        checked={isSelected}
                        onChange={() => setSelectedQualityId(q.id)}
                        disabled={status === "downloading"}
                      />
                      <div className="quality-icon">{isAudio ? <FileAudio size={20} /> : <Film size={20} />}</div>
                      <div className="quality-details">
                        <span className="quality-label">{q.label}</span>
                        <span className="quality-ext">{q.ext.toUpperCase()}</span>
                      </div>
                      {isSelected && (
                        <div className="quality-check">
                          <Check size={14} />
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Destination folder */}
            <div className="folder-section">
              <div className="folder-label">
                <FolderOpen size={16} />
                <span>โฟลเดอร์ปลายทาง:</span>
              </div>
              <div className="folder-display" title={folder}>
                <span className="folder-path">{folder || "ยังไม่ได้เลือกโฟลเดอร์"}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSelectFolder}
                  disabled={status === "downloading"}
                >
                  เปลี่ยน
                </button>
              </div>
            </div>

            {/* Download Status & Action Bar */}
            <div className="action-section">
              {status === "downloading" ? (
                <div className="download-progress-box">
                  <div className="progress-status-row">
                    <div className="progress-message">
                      <LoaderCircle size={16} className="spin" />
                      <span>{progress?.message || "กำลังดาวน์โหลดและประมวลผลไฟล์..."}</span>
                    </div>
                    <button type="button" className="btn btn-danger btn-sm" onClick={handleCancelDownload}>
                      ยกเลิกงาน
                    </button>
                  </div>

                  <progress
                    className="progress-bar"
                    value={Math.min(100, Math.max(0, progress?.progress ?? 0))}
                    max={100}
                  />

                  <div className="progress-metrics">
                    <span>ความเร็ว: {progress?.speed || "-"}</span>
                    <span>เหลือเวลา: {progress?.eta || "-"}</span>
                    <span>{progress?.progress ? `${progress.progress.toFixed(1)}%` : "0%"}</span>
                  </div>
                </div>
              ) : status === "completed" ? (
                <div className="completed-box">
                  <div className="completed-info">
                    <Check size={20} className="text-success" />
                    <div>
                      <strong>ดาวน์โหลดและจัดเก็บไฟล์สำเร็จ!</strong>
                      {savedFile && <div className="saved-file-name">{savedFile}</div>}
                    </div>
                  </div>
                  <div className="completed-actions">
                    <button type="button" className="btn btn-secondary" onClick={handleOpenFolder}>
                      <FolderOpen size={16} />
                      เปิดโฟลเดอร์
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setStatus("ready");
                        setNotice("");
                      }}
                    >
                      ดาวน์โหลดอีกครั้ง
                    </button>
                  </div>
                </div>
              ) : (
                <div className="download-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg download-btn"
                    onClick={handleStartDownload}
                    disabled={!selectedQuality}
                  >
                    <ArrowDown size={18} />
                    บันทึก {selectedQuality?.label || "ไฟล์"}
                  </button>
                  {folder && (
                    <button type="button" className="btn btn-secondary" onClick={handleOpenFolder} title="เปิดโฟลเดอร์ปลายทาง">
                      <FolderOpen size={16} />
                      เปิดโฟลเดอร์
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* History section */}
        <section className="card history-card">
          <div className="history-header">
            <div className="history-title">
              <Clock3 size={17} />
              <span>ประวัติการดาวน์โหลดในเครื่อง</span>
              {recent.length > 0 && <span className="history-count">({recent.length})</span>}
            </div>
            {recent.length > 0 && (
              <button
                type="button"
                className="button-icon-subtle"
                onClick={() => {
                  setRecent([]);
                  try {
                    localStorage.removeItem(HISTORY_STORAGE_KEY);
                  } catch {}
                }}
                title="ล้างประวัติทั้งหมด"
              >
                <Trash2 size={14} />
                ล้างประวัติ
              </button>
            )}
          </div>

          {recent.length > 0 ? (
            <div className="history-list">
              {recent.map((item) => (
                <div key={`${item.url}-${item.date}`} className="history-item">
                  <div className="history-icon">
                    {item.ext === "mp3" ? <FileAudio size={18} /> : <Film size={18} />}
                  </div>
                  <div className="history-info">
                    <span className="history-item-title" title={item.title}>
                      {item.title}
                    </span>
                    <span className="history-meta">
                      {item.platform} · {item.ext.toUpperCase()} ·{" "}
                      {new Date(item.date).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={status === "downloading"}
                    onClick={() => {
                      setUrl(item.url);
                      void handleInspectUrl(item.url);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    title="โหลดลิงก์นี้อีกครั้ง"
                  >
                    โหลดซ้ำ
                  </button>
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
    </div>
  );
}
