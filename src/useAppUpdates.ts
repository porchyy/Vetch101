import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  createUpdaterState,
  UpdaterAction,
  canStartUpdate,
  type UpdaterState,
} from "./updater-state.ts";
import type { AppError, DependencyStatus } from "./models.ts";

export interface UseAppUpdatesOptions {
  folder: string;
  onSetFolder: (dir: string) => void;
  isDownloading: boolean;
  isInspecting: boolean;
  downloadLockActive: boolean;
  onError: (err: AppError | null) => void;
  onNotice: (notice: string) => void;
}

export function useAppUpdates({
  folder,
  onSetFolder,
  isDownloading,
  isInspecting,
  downloadLockActive,
  onError,
  onNotice,
}: UseAppUpdatesOptions) {
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [checkingDeps, setCheckingDeps] = useState(true);
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const updateLock = useRef(false);
  const appUpdateLock = useRef(false);
  const engineChecked = useRef(false);
  const appChecked = useRef(false);

  const [updaterState, setUpdaterState] = useState<UpdaterState>(createUpdaterState());

  const isUpdateBlocked = updatingYtdlp || updateLock.current || updaterState.status === "applying";

  // 1. Initial dependency check and default directory resolution
  const refreshDependencies = useCallback(async () => {
    setCheckingDeps(true);
    try {
      const depStatus = await invoke<DependencyStatus>("check_dependencies");
      setDeps(depStatus);

      if (!folder) {
        const defaultDir = await invoke<string>("get_default_download_dir");
        onSetFolder(defaultDir);
        try {
          localStorage.setItem("vetch101_download_dir", defaultDir);
        } catch {}
      }
    } catch (e) {
      onError({
        summary: "ไม่สามารถตรวจสอบโปรแกรม yt-dlp หรือ FFmpeg ในเครื่องได้",
        detail: String(e),
      });
    } finally {
      setCheckingDeps(false);
    }
  }, [folder, onSetFolder, onError]);

  useEffect(() => {
    void refreshDependencies();
  }, [refreshDependencies]);

  // 2. Engine (yt-dlp) update
  const handleUpdateYtdlp = useCallback(
    async (background = false) => {
      if (downloadLockActive || isDownloading || updateLock.current || isInspecting) return;
      updateLock.current = !background;
      if (!background) setUpdatingYtdlp(true);
      setUpdateMsg(null);
      if (!background) onError(null);
      try {
        const resultMsg = await invoke<string>("update_ytdlp", { background });
        if (!background) setUpdateMsg(resultMsg);
        setDeps(await invoke<DependencyStatus>("check_dependencies"));
      } catch (e) {
        if (!background) {
          onError({
            summary: "การอัปเดต yt-dlp ไม่สำเร็จ",
            detail: String(e),
          });
        }
      } finally {
        if (!background) {
          updateLock.current = false;
          setUpdatingYtdlp(false);
        }
      }
    },
    [downloadLockActive, isDownloading, isInspecting, onError]
  );

  // Background auto-check for engine update on startup
  useEffect(() => {
    if (
      checkingDeps ||
      !deps?.ytdlp_available ||
      engineChecked.current ||
      isDownloading ||
      isInspecting ||
      updateLock.current
    ) {
      return;
    }
    engineChecked.current = true;
    void handleUpdateYtdlp(true);
  }, [checkingDeps, deps, isDownloading, isInspecting, handleUpdateYtdlp]);

  // 3. App update check
  const handleCheckAppUpdate = useCallback(
    async (manual: boolean = false) => {
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
          try {
            dismissed = localStorage.getItem("vetch101_dismissed_update");
          } catch {}
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
            onNotice(`คุณกำลังใช้งานเวอร์ชันล่าสุดแล้ว (${info.current_version})`);
          }
        }
      } catch (e) {
        setUpdaterState(createUpdaterState());
        if (manual) {
          onNotice(`ไม่สามารถตรวจหาอัปเดตได้: ${String(e)}`);
        }
      } finally {
        appUpdateLock.current = false;
      }
    },
    [onNotice]
  );

  // Startup app update check (delayed 2.5s)
  useEffect(() => {
    if (checkingDeps || !deps || appChecked.current) return;
    const timer = setTimeout(() => {
      appChecked.current = true;
      void handleCheckAppUpdate(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [handleCheckAppUpdate, checkingDeps, deps]);

  // Listen to download progress event for app update
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

  // Stage update when available and not busy
  useEffect(() => {
    if (
      updaterState.status !== "available" ||
      appUpdateLock.current ||
      updateLock.current ||
      updatingYtdlp ||
      isDownloading ||
      isInspecting ||
      downloadLockActive
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
    isDownloading,
    isInspecting,
    downloadLockActive,
  ]);

  const handleStartAppUpdate = useCallback(async () => {
    const check = canStartUpdate({
      isDownloading: isDownloading || downloadLockActive || updateLock.current,
      isInspecting: isInspecting,
    });
    if (!check.allowed) {
      onNotice(check.reason || "ไม่สามารถอัปเดตได้ในขณะนี้");
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
  }, [isDownloading, downloadLockActive, isInspecting, updaterState, onNotice]);

  const handleDismissAppUpdate = useCallback(() => {
    if ("version" in updaterState && updaterState.version) {
      try {
        localStorage.setItem("vetch101_dismissed_update", updaterState.version);
      } catch {}
    }
    setUpdaterState(UpdaterAction.dismiss(updaterState));
  }, [updaterState]);

  return {
    deps,
    checkingDeps,
    updatingYtdlp,
    updateMsg,
    setUpdateMsg,
    updaterState,
    isUpdateBlocked,
    refreshDependencies,
    handleUpdateYtdlp,
    handleCheckAppUpdate,
    handleStartAppUpdate,
    handleDismissAppUpdate,
  };
}
