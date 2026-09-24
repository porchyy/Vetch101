import { Check, FolderOpen } from "lucide-react";
import type { PhotoAlbumDetails, VideoDetails } from "../models";
import { VideoResultHeader, VideoQualityActions } from "./VideoResultSubcard";
import {
  PhotoResultHeader,
  PhotoFormatToggle,
  PhotoDownloadActions,
} from "./PhotoResultSubcard";

export type ImageFormat = "jpg" | "png";

export interface FolderConfig {
  path: string;
  onSelect: () => void;
  onOpen: () => void;
}

export interface SessionConfig {
  status: string;
  progress: {
    progress: number;
    speed: string;
    eta: string;
    message: string;
    current?: number;
    total?: number;
  } | null;
  savedFile: string | null;
  isBusy: boolean;
}

export interface ActionConfig {
  onStart: () => void;
  onCancel: () => void;
  onReset?: () => void;
}

export type MediaConfig =
  | {
      type: "video";
      details: VideoDetails;
      platform: string;
      selectedQualityId: string;
      onSelectQuality: (id: string) => void;
    }
  | {
      type: "photo_album";
      details: PhotoAlbumDetails;
      platform: string;
      imageFormat: ImageFormat;
      onSelectFormat: (fmt: ImageFormat) => void;
      selectedIndices?: number[];
      onToggleIndex?: (index: number) => void;
      onSelectAll?: () => void;
      onDeselectAll?: () => void;
    };

export interface MediaResultCardProps {
  media: MediaConfig;
  folder: FolderConfig;
  session: SessionConfig;
  actions: ActionConfig;
}

export function MediaResultCard({
  media,
  folder,
  session,
  actions,
}: MediaResultCardProps) {
  const isDownloading = session.status === "downloading";
  const isCompleted = session.status === "completed";

  return (
    <section
      className={`card result-card ${
        media.type === "photo_album" ? "photo-result-card" : ""
      }`}
    >
      {/* 1. Media Header Slot */}
      {media.type === "video" ? (
        <VideoResultHeader details={media.details} platform={media.platform} />
      ) : (
        <PhotoResultHeader
          details={media.details}
          platform={media.platform}
          selectedIndices={media.selectedIndices}
          onToggleIndex={media.onToggleIndex}
          onSelectAll={media.onSelectAll}
          onDeselectAll={media.onDeselectAll}
          isDownloading={isDownloading}
        />
      )}

      {/* 2. Destination Folder Section (Unified) */}
      <div className="folder-section">
        <div className="folder-label">
          <FolderOpen size={16} />
          <span>โฟลเดอร์ปลายทาง:</span>
        </div>
        <div className="folder-display" title={folder.path}>
          <span className="folder-path">
            {folder.path || "ยังไม่ได้เลือกโฟลเดอร์"}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={folder.onSelect}
            disabled={isDownloading}
          >
            เปลี่ยน
          </button>
        </div>
      </div>

      {/* 3. Media-Specific Controls Slot (Photo format toggle) */}
      {media.type === "photo_album" && !isDownloading && !isCompleted && (
        <PhotoFormatToggle
          imageFormat={media.imageFormat}
          onSelectFormat={media.onSelectFormat}
        />
      )}

      {/* 4. Action Section (Unified Progress / Completion / Action Buttons) */}
      <div className="action-section">
        {isDownloading ? (
          <div className="download-progress-box">
            <div className="progress-status-row">
              <div className="progress-message">
                <span>
                  {session.progress?.message ||
                    (session.progress?.current && session.progress?.total
                      ? `กำลังดาวน์โหลดรูปที่ ${session.progress.current}/${session.progress.total}`
                      : "กำลังดาวน์โหลดและประมวลผลไฟล์...")}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={actions.onCancel}
              >
                ยกเลิกงาน
              </button>
            </div>
            <progress
              className="progress-bar"
              value={Math.min(100, Math.max(0, session.progress?.progress ?? 0))}
              max={100}
            />
            <div className="progress-metrics">
              <span>ความเร็ว: {session.progress?.speed || "-"}</span>
              <span>เหลือเวลา: {session.progress?.eta || "-"}</span>
              <span>
                {session.progress?.progress
                  ? `${session.progress.progress.toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
          </div>
        ) : isCompleted ? (
          <div className="completed-box">
            <div className="completed-info">
              <Check size={20} className="text-success" />
              <div>
                <strong>
                  {session.progress?.message ||
                    (media.type === "photo_album"
                      ? "ดาวน์โหลดรูปภาพสำเร็จ!"
                      : "ดาวน์โหลดและจัดเก็บไฟล์สำเร็จ!")}
                </strong>
                {session.savedFile && (
                  <div className="saved-file-name">{session.savedFile}</div>
                )}
              </div>
            </div>
            <div className="completed-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={folder.onOpen}
              >
                <FolderOpen size={16} />
                เปิดโฟลเดอร์
              </button>
              {actions.onReset && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={actions.onReset}
                >
                  ดาวน์โหลดอีกครั้ง
                </button>
              )}
            </div>
          </div>
        ) : media.type === "video" ? (
          <VideoQualityActions
            details={media.details}
            selectedQualityId={media.selectedQualityId}
            onSelectQuality={media.onSelectQuality}
            folder={folder}
            session={session}
            actions={actions}
          />
        ) : (
          <PhotoDownloadActions
            details={media.details}
            imageFormat={media.imageFormat}
            selectedIndices={media.selectedIndices}
            folder={folder}
            session={session}
            actions={actions}
          />
        )}
      </div>
    </section>
  );
}
