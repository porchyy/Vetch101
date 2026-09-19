import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DownloadOutcome, DownloadProgressPayload, MediaDetails } from "./models.ts";
import { parseDroppedVideoUrl, parseVideoUrl } from "./video-url.ts";
import {
  addHistoryItem,
  clearHistory,
  detectPlatform,
  getHistory,
  removeHistoryItem,
  type HistoryItem,
} from "./history.ts";
import type {
  ActionConfig,
  ImageFormat,
  MediaConfig,
  SessionConfig,
} from "./components/MediaResultCard";
import type { AppError, Status } from "./models.ts";

export type { DownloadProgressPayload };

export interface DownloadSessionState {
  url: string;
  meta: MediaDetails | null;
  selectedQualityId: string;
  status: Status;
  error: AppError | null;
  notice: string;
  progress: DownloadProgressPayload | null;
  savedFile: string | null;
  imageFormat: ImageFormat;
  revision: number;
}

const IMAGE_FORMAT_STORAGE_KEY = "vetch101_image_format";

export const initialSessionState: DownloadSessionState = {
  url: "",
  meta: null,
  selectedQualityId: "",
  status: "idle",
  error: null,
  notice: "",
  progress: null,
  savedFile: null,
  imageFormat: "jpg",
  revision: 0,
};

export type SessionAction =
  | { type: "change_url"; url: string }
  | { type: "start_inspect"; url: string; revision: number }
  | { type: "inspect_success"; revision: number; meta: MediaDetails }
  | { type: "inspect_failure"; revision: number; error: AppError }
  | { type: "select_quality"; id: string }
  | { type: "select_format"; format: ImageFormat }
  | { type: "start_download" }
  | { type: "download_progress"; payload: DownloadProgressPayload }
  | { type: "download_success"; notice: string; savedFile?: string }
  | { type: "download_cancelled" }
  | { type: "download_failure"; error: AppError }
  | { type: "set_error"; error: AppError | null }
  | { type: "set_notice"; notice: string }
  | { type: "reset_status" };

export function sessionReducer(
  state: DownloadSessionState,
  action: SessionAction
): DownloadSessionState {
  switch (action.type) {
    case "change_url":
      return {
        ...state,
        url: action.url,
        meta: null,
        selectedQualityId: "",
        status: "idle",
        error: null,
        notice: "",
        progress: null,
        savedFile: null,
        revision: state.revision + 1,
      };

    case "start_inspect":
      return {
        ...state,
        url: action.url,
        meta: null,
        selectedQualityId: "",
        status: "checking",
        error: null,
        notice: "",
        progress: null,
        savedFile: null,
        revision: action.revision,
      };

    case "inspect_success": {
      if (action.revision !== state.revision || state.status !== "checking") {
        return state;
      }
      let initialQuality = "";
      if ("qualities" in action.meta && Array.isArray(action.meta.qualities) && action.meta.qualities.length > 0) {
        initialQuality = action.meta.qualities[0]?.id ?? "";
      }
      return {
        ...state,
        meta: action.meta,
        selectedQualityId: initialQuality,
        status: "ready",
        error: null,
      };
    }

    case "inspect_failure":
      if (action.revision !== state.revision || state.status !== "checking") {
        return state;
      }
      return {
        ...state,
        status: "idle",
        error: action.error,
      };

    case "select_quality":
      return {
        ...state,
        selectedQualityId: action.id,
      };

    case "select_format":
      return {
        ...state,
        imageFormat: action.format,
      };

    case "start_download":
      return {
        ...state,
        status: "downloading",
        error: null,
        notice: "",
        progress: null,
        savedFile: null,
      };

    case "download_progress":
      if (state.status !== "downloading") return state;
      return {
        ...state,
        progress: action.payload,
        savedFile: action.payload.filename || state.savedFile,
      };

    case "download_success":
      return {
        ...state,
        status: "completed",
        notice: action.notice,
        savedFile: action.savedFile || state.savedFile,
      };

    case "download_cancelled":
      return {
        ...state,
        status: "ready",
        notice: "ยกเลิกการดาวน์โหลดแล้ว",
      };

    case "download_failure":
      return {
        ...state,
        status: "ready",
        error: action.error,
      };

    case "set_error":
      return {
        ...state,
        error: action.error,
      };

    case "set_notice":
      return {
        ...state,
        notice: action.notice,
      };

    case "reset_status":
      return {
        ...state,
        status: "ready",
        notice: "",
        progress: null,
      };

    default:
      return state;
  }
}

export interface UseDownloadSessionOptions {
  folder: string;
  isBlocked?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function useDownloadSession({
  folder,
  isBlocked = false,
  inputRef,
}: UseDownloadSessionOptions) {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState, (init) => {
    let initialFormat: ImageFormat = "jpg";
    try {
      const saved = localStorage.getItem(IMAGE_FORMAT_STORAGE_KEY);
      if (saved === "png") initialFormat = "png";
    } catch {}
    return { ...init, imageFormat: initialFormat };
  });

  const [recent, setRecent] = useState<HistoryItem[]>(() => getHistory());

  const downloadLock = useRef(false);
  const revisionRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Listen for download-progress events from backend
  useEffect(() => {
    const unlisten = listen<DownloadProgressPayload>("download-progress", (event) => {
      dispatch({ type: "download_progress", payload: event.payload });
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // 2. Change URL handler
  const changeUrl = useCallback((value: string) => {
    if (downloadLock.current) return;
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    revisionRef.current += 1;
    dispatch({ type: "change_url", url: value });
  }, []);

  // 3. Inspect URL
  const inspectUrl = useCallback(
    async (urlToInspect?: string) => {
      if (downloadLock.current || isBlocked) return;
      const target = (urlToInspect ?? state.url).trim();

      let cleanUrl = "";
      try {
        cleanUrl = parseVideoUrl(target);
      } catch (err) {
        dispatch({
          type: "set_error",
          error: { summary: err instanceof Error ? err.message : String(err) },
        });
        inputRef?.current?.focus();
        return;
      }

      const request = ++revisionRef.current;
      dispatch({ type: "start_inspect", url: cleanUrl, revision: request });

      try {
        const metadata = await invoke<MediaDetails>("fetch_metadata", { url: cleanUrl });
        dispatch({ type: "inspect_success", revision: request, meta: metadata });
      } catch (err) {
        dispatch({
          type: "inspect_failure",
          revision: request,
          error: {
            summary: "ไม่สามารถดึงข้อมูลวิดีโอจากลิงก์นี้ได้",
            detail: String(err),
          },
        });
      }
    },
    [isBlocked, state.url, inputRef]
  );

  // 4. Schedule inspection (debounced)
  const scheduleInspect = useCallback(
    (value: string, delay: number) => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void inspectUrl(value);
      }, delay);
    },
    [inspectUrl]
  );

  // 5. Start Video Download
  const startDownload = useCallback(async () => {
    if (
      !state.meta ||
      state.meta.type !== "video" ||
      downloadLock.current ||
      isBlocked ||
      state.status !== "ready"
    ) {
      return;
    }

    const selected = state.meta.qualities.find((q) => q.id === state.selectedQualityId);
    if (!selected) {
      dispatch({
        type: "set_error",
        error: { summary: "กรุณาเลือกความละเอียดหรือรูปแบบไฟล์ที่ต้องการ" },
      });
      return;
    }

    if (!folder) {
      dispatch({
        type: "set_error",
        error: { summary: "กรุณาเลือกโฟลเดอร์สำหรับบันทึกไฟล์" },
      });
      return;
    }

    downloadLock.current = true;
    dispatch({ type: "start_download" });

    try {
      const outcome = await invoke<DownloadOutcome>("start_download", {
        url: state.url,
        formatSpec: selected.format_spec,
        downloadDir: folder,
      });

      const finalName =
        outcome.kind === "video"
          ? outcome.file_name
          : state.savedFile || `${state.meta.title}.${selected.ext}`;
      const finalPath =
        outcome.kind === "video"
          ? outcome.file_path
          : folder
          ? `${folder}\\${finalName}`
          : undefined;

      addHistoryItem({
        id: state.meta.id || String(Date.now()),
        title: state.meta.title,
        url: state.url,
        platform: detectPlatform(state.url),
        ext: selected.ext,
        filename: finalName,
        filepath: finalPath,
        filesize: selected.filesize_approx,
      });
      setRecent(getHistory());

      dispatch({
        type: "download_success",
        notice: "บันทึกไฟล์เรียบร้อยแล้ว",
        savedFile: finalName,
      });
    } catch (err) {
      const errStr = String(err);
      if (errStr.includes("ยกเลิก")) {
        dispatch({ type: "download_cancelled" });
      } else {
        dispatch({
          type: "download_failure",
          error: {
            summary: "ดาวน์โหลดไม่สำเร็จ",
            detail: errStr,
          },
        });
      }
    } finally {
      downloadLock.current = false;
    }
  }, [state.meta, state.selectedQualityId, state.status, state.url, state.savedFile, folder, isBlocked]);

  // 6. Start Photo Album Download
  const startPhotoDownload = useCallback(async () => {
    if (
      !state.meta ||
      state.meta.type !== "photo_album" ||
      downloadLock.current ||
      isBlocked ||
      state.status !== "ready"
    ) {
      return;
    }

    if (!folder) {
      dispatch({
        type: "set_error",
        error: { summary: "กรุณาเลือกโฟลเดอร์สำหรับบันทึกไฟล์" },
      });
      return;
    }

    downloadLock.current = true;
    dispatch({ type: "start_download" });

    try {
      const outcome = await invoke<DownloadOutcome>("download_photo_post", {
        url: state.url,
        downloadDir: folder,
        format: state.imageFormat,
      });

      if (outcome.kind === "photo_album") {
        let noticeMsg = "";
        if (outcome.failed_indices.length === 0) {
          noticeMsg = `บันทึกรูปภาพครบทั้ง ${outcome.total} รูปเรียบร้อยแล้ว`;
        } else {
          noticeMsg = `ดาวน์โหลดสำเร็จ ${outcome.succeeded}/${outcome.total} รูป (รูปที่ ${outcome.failed_indices.join(
            ", "
          )} ล้มเหลว)`;
        }

        const firstSaved = outcome.saved_files[0];
        const primaryPath =
          outcome.primary_file_path ||
          (firstSaved && folder ? `${folder}\\${firstSaved}` : folder);

        addHistoryItem({
          id: state.meta.id || String(Date.now()),
          title: state.meta.title,
          url: state.url,
          platform: detectPlatform(state.url),
          ext: state.imageFormat,
          filename: firstSaved || `${state.meta.title} (${outcome.succeeded} รูป)`,
          filepath: primaryPath,
        });
        setRecent(getHistory());

        dispatch({
          type: "download_success",
          notice: noticeMsg,
          savedFile: firstSaved,
        });
      }
    } catch (err) {
      const errStr = String(err);
      if (errStr.includes("ยกเลิก")) {
        dispatch({ type: "download_cancelled" });
      } else {
        dispatch({
          type: "download_failure",
          error: {
            summary: "ดาวน์โหลดรูปภาพไม่สำเร็จ",
            detail: errStr,
          },
        });
      }
    } finally {
      downloadLock.current = false;
    }
  }, [state.meta, state.status, state.url, state.imageFormat, folder, isBlocked]);

  // 7. Cancel running download
  const cancelDownload = useCallback(async () => {
    if (state.status !== "downloading") return;
    try {
      await invoke("cancel_download");
      dispatch({ type: "set_notice", notice: "ส่งคำสั่งยกเลิกแล้ว" });
    } catch (e) {
      dispatch({
        type: "set_error",
        error: { summary: "ไม่สามารถยกเลิกงานได้", detail: String(e) },
      });
    }
  }, [state.status]);

  // 8. Quality & format selection
  const setSelectedQualityId = useCallback((id: string) => {
    dispatch({ type: "select_quality", id });
  }, []);

  const setImageFormat = useCallback((format: ImageFormat) => {
    dispatch({ type: "select_format", format });
    try {
      localStorage.setItem(IMAGE_FORMAT_STORAGE_KEY, format);
    } catch {}
  }, []);

  // 9. Input helper events
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").trim();
      changeUrl(pasted);
      if (pasted) scheduleInspect(pasted, 0);
    },
    [changeUrl, scheduleInspect]
  );

  const handlePasteClipboard = useCallback(async () => {
    try {
      const curRev = revisionRef.current;
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText && revisionRef.current === curRev) {
        const pasted = clipboardText.trim();
        changeUrl(pasted);
        inputRef?.current?.focus();
        if (pasted) scheduleInspect(pasted, 0);
      }
    } catch {
      dispatch({ type: "set_notice", notice: "กรุณากด Ctrl+V เพื่อวางลิงก์" });
    }
  }, [changeUrl, scheduleInspect, inputRef]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (downloadLock.current || state.status === "checking" || e.dataTransfer.files.length) {
        return;
      }
      try {
        const droppedUrl = parseDroppedVideoUrl(
          e.dataTransfer.getData("text/uri-list"),
          e.dataTransfer.getData("text/plain")
        );
        changeUrl(droppedUrl);
        inputRef?.current?.focus();
        if (droppedUrl) scheduleInspect(droppedUrl, 0);
      } catch (err) {
        dispatch({
          type: "set_error",
          error: { summary: err instanceof Error ? err.message : String(err) },
        });
      }
    },
    [state.status, changeUrl, scheduleInspect, inputRef]
  );

  const handleClear = useCallback(() => {
    if (downloadLock.current) return;
    changeUrl("");
    inputRef?.current?.focus();
  }, [changeUrl, inputRef]);

  const resetStatus = useCallback(() => {
    dispatch({ type: "reset_status" });
  }, []);

  const setError = useCallback((error: AppError | null) => {
    dispatch({ type: "set_error", error });
  }, []);

  const setNotice = useCallback((notice: string) => {
    dispatch({ type: "set_notice", notice });
  }, []);

  // 10. History actions
  const removeHistory = useCallback((date: number) => {
    const updated = removeHistoryItem(date);
    setRecent(updated);
  }, []);

  const clearAllHistory = useCallback(() => {
    clearHistory();
    setRecent([]);
  }, []);

  const handleOpenFile = useCallback(async (filepath?: string) => {
    if (!filepath) return;
    try {
      await invoke("open_file", { path: filepath });
    } catch (e) {
      dispatch({
        type: "set_error",
        error: { summary: "ไม่สามารถเปิดไฟล์ได้", detail: String(e) },
      });
    }
  }, []);

  const handleRevealFolder = useCallback(
    async (filepath?: string) => {
      if (!filepath) return;
      try {
        await invoke("reveal_in_folder", { path: filepath });
      } catch {
        if (folder) {
          await invoke("open_folder", { path: folder }).catch(() => {});
        }
      }
    },
    [folder]
  );

  const handleCopyLink = useCallback(async (urlStr: string) => {
    try {
      await navigator.clipboard.writeText(urlStr);
      dispatch({ type: "set_notice", notice: "คัดลอกลิงก์ต้นทางเรียบร้อยแล้ว" });
    } catch {}
  }, []);

  // 11. Structured MediaResultCard props
  const mediaConfig: MediaConfig | null = !state.meta
    ? null
    : state.meta.type === "photo_album"
    ? {
        type: "photo_album",
        details: state.meta,
        platform: detectPlatform(state.url),
        imageFormat: state.imageFormat,
        onSelectFormat: setImageFormat,
      }
    : {
        type: "video",
        details: state.meta,
        platform: detectPlatform(state.url),
        selectedQualityId: state.selectedQualityId,
        onSelectQuality: setSelectedQualityId,
      };

  const sessionConfig: SessionConfig = {
    status: state.status,
    progress: state.progress,
    savedFile: state.savedFile,
    isBusy: isBlocked,
  };

  const actionConfig: ActionConfig = {
    onStart: state.meta?.type === "photo_album" ? startPhotoDownload : startDownload,
    onCancel: cancelDownload,
    onReset: resetStatus,
  };

  return {
    // Raw state properties
    url: state.url,
    meta: state.meta,
    selectedQualityId: state.selectedQualityId,
    status: state.status,
    error: state.error,
    notice: state.notice,
    progress: state.progress,
    savedFile: state.savedFile,
    imageFormat: state.imageFormat,
    revision: state.revision,
    recent,

    // Derived flags
    isDownloading: state.status === "downloading",
    isInspecting: state.status === "checking",
    downloadLockActive: downloadLock.current,

    // Config bundles for MediaResultCard
    mediaConfig,
    sessionConfig,
    actionConfig,

    // Actions
    changeUrl,
    inspectUrl,
    scheduleInspect,
    startDownload,
    startPhotoDownload,
    cancelDownload,
    resetStatus,
    setSelectedQualityId,
    setImageFormat,
    handlePaste,
    handlePasteClipboard,
    handleDrop,
    handleClear,
    handleOpenFile,
    handleRevealFolder,
    handleCopyLink,
    removeHistory,
    clearAllHistory,
    setError,
    setNotice,
  };
}
