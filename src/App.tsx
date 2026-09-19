import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { initialVideoInput, videoInputReducer, type AppError, type Status, type VideoMetadata } from "./video-input";
import { parseDroppedVideoUrl, parseVideoUrl } from "./video-url";
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
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { formatBytes } from "./history";
import { UpdateBanner } from "./components/UpdateBanner";
import { VideoResultCard } from "./components/VideoResultCard";
import { PhotoResultCard, type ImageFormat } from "./components/PhotoResultCard";
import { createUpdaterState, UpdaterAction, canStartUpdate, type UpdaterState } from "./updater-state";

interface DownloadProgressPayload {
  progress: number;
  speed: string;
  eta: string;
  status: string;
  message: string;
  filename?: string;
}

interface PhotoDownloadResult {
  total: number;
  succeeded: number;
  failed_indices: number[];
  saved_files: string[];
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
  filepath?: string;
  filesize?: number | null;
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



export default function App() {
  const [{ url, meta, selectedQualityId, status, error }, dispatchInput] = useReducer(videoInputReducer, initialVideoInput);
  const revision = useRef(0);
  const setStatus = (status: Status) => dispatchInput({ type: "patch", patch: { status } });
  const setError = (error: AppError | null) => dispatchInput({ type: "patch", patch: { error } });
  const setSelectedQualityId = (selectedQualityId: string) => dispatchInput({ type: "patch", patch: { selectedQualityId } });
  const [folder, setFolder] = useState<string>(() => {
    return localStorage.getItem(FOLDER_STORAGE_KEY) || "";
  });

  const [progress, setProgress] = useState<DownloadProgressPayload | null>(null);
  const [savedFile, setSavedFile] = useState<string | null>(null);

  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [checkingDeps, setCheckingDeps] = useState(true);
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const [notice, setNotice] = useState("");
  const IMAGE_FORMAT_KEY = "vetch101_image_format";
  const [imageFormat, setImageFormat] = useState<ImageFormat>(() => {
    const saved = localStorage.getItem(IMAGE_FORMAT_KEY);
    return saved === "png" ? "png" : "jpg";
  });
  const handleSelectImageFormat = (fmt: ImageFormat) => {
    setImageFormat(fmt);
    try { localStorage.setItem(IMAGE_FORMAT_KEY, fmt); } catch {}
  };

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
  const updateLock = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (downloadLock.current || updateLock.current || status === "checking") return;
    updateLock.current = true;
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
      updateLock.current = false;
      setUpdatingYtdlp(false);
    }
  };

  // App updater state & actions
  const [updaterState, setUpdaterState] = useState<UpdaterState>(createUpdaterState());

  const handleCheckAppUpdate = useCallback(async (manual: boolean = false) => {
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
        const dismissed = localStorage.getItem("vetch101_dismissed_update");
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
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void handleCheckAppUpdate(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [handleCheckAppUpdate]);

  const handleStartAppUpdate = async () => {
    const check = canStartUpdate({
      isDownloading: status === "downloading",
      isInspecting: status === "checking",
    });
    if (!check.allowed) {
      setNotice(check.reason || "ไม่สามารถอัปเดตได้ในขณะนี้");
      return;
    }

    if (updaterState.status !== "available" || !updaterState.setupUrl) {
      return;
    }

    setUpdaterState(UpdaterAction.startDownload(updaterState));
    try {
      await invoke("install_app_update", { setupUrl: updaterState.setupUrl });
      setUpdaterState(UpdaterAction.ready(updaterState));
    } catch (e) {
      setUpdaterState(UpdaterAction.error(updaterState, String(e)));
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

  const handleOpenUrl = async (urlStr: string) => {
    try {
      await invoke("open_external_url", { url: urlStr });
    } catch {
      window.open(urlStr, "_blank");
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

  const changeUrl = (value: string) => {
    if (downloadLock.current) return;
    // Cancel any in-flight typing debounce
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    revision.current += 1;
    dispatchInput({ type: "change", url: value });
    setNotice("");
    setProgress(null);
    setSavedFile(null);
  };

  /** Trigger inspection immediately (paste/drop) or via debounce (typing). */
  const scheduleInspect = useCallback(
    (value: string, delay: number) => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void handleInspectUrl(value);
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    changeUrl(pasted);
    if (pasted) scheduleInspect(pasted, 0);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (downloadLock.current || status === "checking" || e.dataTransfer.files.length) return;
    try {
      const droppedUrl = parseDroppedVideoUrl(
        e.dataTransfer.getData("text/uri-list"),
        e.dataTransfer.getData("text/plain"),
      );
      changeUrl(droppedUrl);
      inputRef.current?.focus();
      if (droppedUrl) scheduleInspect(droppedUrl, 0);
    } catch (err) {
      setError({ summary: err instanceof Error ? err.message : String(err) });
    }
  };

  // Clear current input and state
  const handleClear = () => {
    if (downloadLock.current) return;
    changeUrl("");
    inputRef.current?.focus();
  };

  // Inspect video URL
  const handleInspectUrl = async (urlToInspect?: string) => {
    if (downloadLock.current || updateLock.current) return;
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

    const request = ++revision.current;
    dispatchInput({ type: "inspect", url: cleanUrl, revision: request });
    setNotice("");
    setProgress(null);
    setSavedFile(null);

    try {
      const metadata = await invoke<VideoMetadata>("fetch_metadata", { url: cleanUrl });
      dispatchInput({ type: "success", revision: request, meta: metadata });
    } catch (err) {
      dispatchInput({ type: "failure", revision: request, error: {
        summary: "ไม่สามารถดึงข้อมูลวิดีโอจากลิงก์นี้ได้",
        detail: String(err),
      } });
    }
  };

  // Start download
  const handleStartDownload = async () => {
    if (!meta || downloadLock.current || updateLock.current || status !== "ready") return;
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
      const finalName = savedFile || `${meta.title}.${selected.ext}`;
      const finalPath = folder ? `${folder}\\${finalName}` : undefined;
      const item: RecentItem = {
        id: meta.id || String(Date.now()),
        title: meta.title,
        url,
        platform: detectPlatform(url),
        ext: selected.ext,
        date: Date.now(),
        filename: finalName,
        filepath: finalPath,
        filesize: selected.filesize_approx,
      };

      setRecent((prev) => {
        const next = [item, ...prev.filter((x) => x.url !== url)].slice(0, 50);
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

  // Start photo post download (Ticket 6: wired to real Rust photo command)
  const handleStartPhotoDownload = async () => {
    if (!meta || downloadLock.current || updateLock.current || status !== "ready") return;
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
      const result = await invoke<PhotoDownloadResult>("download_photo_post", {
        url,
        downloadDir: folder,
        format: imageFormat,
      });
      setStatus("completed");
      if (result.failed_indices.length === 0) {
        setNotice(`บันทึกรูปภาพครบทั้ง ${result.total} รูปเรียบร้อยแล้ว`);
      } else {
        setNotice(
          `ดาวน์โหลดสำเร็จ ${result.succeeded}/${result.total} รูป (รูปที่ ${result.failed_indices.join(", ")} ล้มเหลว)`,
        );
      }
      const firstSaved = result.saved_files[0];
      const item: RecentItem = {
        id: meta.id || String(Date.now()),
        title: meta.title,
        url,
        platform: detectPlatform(url),
        ext: imageFormat,
        date: Date.now(),
        filename: firstSaved || `${meta.title} (${result.succeeded} รูป)`,
        filepath: firstSaved && folder ? `${folder}\\${firstSaved}` : folder,
      };
      setRecent((prev) => {
        const next = [item, ...prev.filter((x) => x.url !== url)].slice(0, 50);
        try { localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    } catch (err) {
      setStatus("ready");
      const errStr = String(err);
      if (errStr.includes("ยกเลิก")) {
        setNotice("ยกเลิกการดาวน์โหลดแล้ว");
      } else {
        setError({ summary: "ดาวน์โหลดรูปภาพไม่สำเร็จ", detail: errStr });
      }
    } finally {
      downloadLock.current = false;
    }
  };

  // History quick actions
  const handleOpenFile = async (filepath?: string) => {
    if (!filepath) return;
    try {
      await invoke("open_file", { path: filepath });
    } catch (e) {
      setError({
        summary: "ไม่สามารถเปิดไฟล์ได้",
        detail: String(e),
      });
    }
  };

  const handleRevealFolder = async (filepath?: string) => {
    if (!filepath) return;
    try {
      await invoke("reveal_in_folder", { path: filepath });
    } catch {
      if (folder) {
        await invoke("open_folder", { path: folder }).catch(() => {});
      }
    }
  };

  const handleCopyLink = async (urlStr: string) => {
    try {
      await navigator.clipboard.writeText(urlStr);
      setNotice("คัดลอกลิงก์ต้นทางเรียบร้อยแล้ว");
    } catch {}
  };

  const handleRemoveHistoryItem = (date: number) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x.date !== date);
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div
      className="app-shell"
      onDragOver={(e) => {
        e.preventDefault();
        const types = e.dataTransfer.types;
        e.dataTransfer.dropEffect = !downloadLock.current && status !== "checking"
          && !types.includes("Files") && (types.includes("text/uri-list") || types.includes("text/plain"))
          ? "copy" : "none";
      }}
      onDrop={handleDrop}
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
                onClick={handleUpdateYtdlp}
                disabled={updatingYtdlp || status === "downloading" || status === "checking"}
                title="ตรวจสอบและอัปเดต yt-dlp เป็นเวอร์ชันล่าสุด"
              >
                <RefreshCw size={13} className={updatingYtdlp ? "spin" : ""} />
                {updatingYtdlp ? "กำลังอัปเดต" : "อัปเดต yt-dlp"}
              </button>
              <button
                className="button-icon-subtle"
                onClick={() => handleCheckAppUpdate(true)}
                disabled={updaterState.status === "checking" || updaterState.status === "downloading" || status === "downloading"}
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
        </div>
      </header>

      {/* Main workspace */}
      <main className="main-content">
        <UpdateBanner
          state={updaterState}
          isDownloading={status === "downloading"}
          isInspecting={status === "checking"}
          onStartUpdate={handleStartAppUpdate}
          onDismiss={handleDismissAppUpdate}
          onOpenExternalUrl={handleOpenUrl}
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
              value={url}
              onChange={(e) => {
                const nextVal = e.target.value;
                changeUrl(nextVal);
                let valid = false;
                try { parseVideoUrl(nextVal.trim()); valid = true; } catch {}
                if (valid) {
                  scheduleInspect(nextVal.trim(), 800);
                }
              }}
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
                    const pasteRevision = revision.current;
                    const clipboardText = await navigator.clipboard.readText();
                    if (clipboardText && revision.current === pasteRevision) {
                      const pasted = clipboardText.trim();
                      changeUrl(pasted);
                      inputRef.current?.focus();
                      if (pasted) scheduleInspect(pasted, 0);
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
              disabled={updatingYtdlp || status === "downloading" || status === "checking" || !url.trim()}
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

        {/* Result card — split by post type */}
        {meta && meta.post_type === "photo_post" ? (
          <PhotoResultCard
            meta={meta}
            platform={detectPlatform(url)}
            imageFormat={imageFormat}
            onSelectFormat={handleSelectImageFormat}
            folder={folder}
            onSelectFolder={handleSelectFolder}
            onOpenFolder={handleOpenFolder}
            status={status}
            progress={progress}
            savedFile={savedFile}
            updatingYtdlp={updatingYtdlp}
            onStartDownload={handleStartPhotoDownload}
            onCancelDownload={handleCancelDownload}
            onDownloadAgain={() => {
              setStatus("ready");
              setNotice("");
            }}
          />
        ) : meta ? (
          <VideoResultCard
            meta={meta}
            platform={detectPlatform(url)}
            selectedQualityId={selectedQualityId}
            onSelectQuality={setSelectedQualityId}
            folder={folder}
            onSelectFolder={handleSelectFolder}
            onOpenFolder={handleOpenFolder}
            status={status}
            progress={progress}
            savedFile={savedFile}
            updatingYtdlp={updatingYtdlp}
            onStartDownload={handleStartDownload}
            onCancelDownload={handleCancelDownload}
            onDownloadAgain={() => {
              setStatus("ready");
              setNotice("");
            }}
          />
        ) : null}

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
                    {item.ext === "mp3" ? (
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
                        onClick={() => handleOpenFile(item.filepath)}
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
                        onClick={() => handleRevealFolder(item.filepath)}
                        title="เปิดโฟลเดอร์และชี้ตำแหน่งไฟล์ในเครื่อง"
                      >
                        <FolderOpen size={13} />
                        โฟลเดอร์
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopyLink(item.url)}
                      title="คัดลอกลิงก์ต้นทาง"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={status === "downloading"}
                      onClick={() => {
                        void handleInspectUrl(item.url);
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
                      onClick={() => handleRemoveHistoryItem(item.date)}
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
    </div>
  );
}
