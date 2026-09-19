import { useState } from "react";
import {
  ArrowDown,
  Check,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Film,
  FolderOpen,
  Image as ImageIcon,
} from "lucide-react";
import { formatBytes } from "../history";
import type { PhotoAlbumDetails, QualityOption, VideoDetails } from "../models";

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

function formatDuration(seconds?: number | null): string {
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

export function MediaResultCard({
  media,
  folder,
  session,
  actions,
}: MediaResultCardProps) {
  const [showExtras, setShowExtras] = useState(false);
  const isDownloading = session.status === "downloading";
  const isCompleted = session.status === "completed";

  return (
    <section className={`card result-card ${media.type === "photo_album" ? "photo-result-card" : ""}`}>
      {/* 1. Media Header Slot */}
      {media.type === "video" ? (
        <div className="video-summary">
          <div className="thumbnail-wrapper">
            {media.details.thumbnail ? (
              <img
                src={media.details.thumbnail}
                alt={media.details.title}
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
            {media.details.duration && media.details.duration > 0 && (
              <span className="duration-tag">{formatDuration(media.details.duration)}</span>
            )}
            {media.details.filesize_approx ? (
              <span className="filesize-tag">{formatBytes(media.details.filesize_approx)}</span>
            ) : null}
          </div>
          <div className="video-info">
            <div className="video-channel">
              <span className="platform-badge">{media.platform}</span>
              {media.details.channel && <span className="channel-name">{media.details.channel}</span>}
            </div>
            <h2 className="video-title">{media.details.title}</h2>
          </div>
        </div>
      ) : (
        <>
          <div className="photo-summary">
            <div className="video-info">
              <div className="video-channel">
                <span className="platform-badge">{media.platform}</span>
                {media.details.channel && <span className="channel-name">{media.details.channel}</span>}
              </div>
              <h2 className="video-title">{media.details.title}</h2>
              <span className="photo-count">
                <ImageIcon size={14} />
                {media.details.images.length > 0 ? `${media.details.images.length} รูป` : "โพสต์รูปภาพ"}
              </span>
            </div>
          </div>

          {/* Photo strip preview with interactive selection */}
          {media.details.images.length > 0 && (
            <div className="photo-selection-wrapper">
              <div className="photo-selection-header">
                <span className="photo-selection-count">
                  เลือกแล้ว <strong>{media.selectedIndices ? media.selectedIndices.length : media.details.images.length}</strong> จาก {media.details.images.length} รูป
                </span>
                <div className="photo-selection-btns">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm photo-select-btn"
                    onClick={media.onSelectAll}
                    disabled={isDownloading || (media.selectedIndices ? media.selectedIndices.length === media.details.images.length : true)}
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm photo-select-btn"
                    onClick={media.onDeselectAll}
                    disabled={isDownloading || (media.selectedIndices ? media.selectedIndices.length === 0 : false)}
                  >
                    ล้างการเลือก
                  </button>
                </div>
              </div>

              <div className="photo-strip" role="list" aria-label="รูปภาพในโพสต์">
                {media.details.images.map((img, idx) => {
                  const isSelected = media.selectedIndices ? media.selectedIndices.includes(idx) : true;
                  return (
                    <div
                      key={img.index}
                      className={`photo-strip-item ${isSelected ? "selected-photo" : "unselected-photo"}`}
                      role="listitem"
                      onClick={() => {
                        if (!isDownloading && media.onToggleIndex) {
                          media.onToggleIndex(idx);
                        }
                      }}
                      style={{ cursor: isDownloading ? "default" : "pointer" }}
                      title={`คลิกเพื่อ${isSelected ? "ยกเลิก" : "เลือก"}รูปที่ ${img.index}`}
                    >
                      <img
                        src={img.preview_url}
                        alt={`รูปที่ ${img.index}`}
                        className="photo-strip-img"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <div className={`photo-check-badge ${isSelected ? "checked" : ""}`}>
                        {isSelected ? <Check size={12} /> : null}
                      </div>
                      <span className="photo-strip-index">{img.index}</span>
                      {img.width && img.height && (
                        <span className="photo-strip-dim">
                          {img.width}×{img.height}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 2. Destination Folder Section (Unified) */}
      <div className="folder-section">
        <div className="folder-label">
          <FolderOpen size={16} />
          <span>โฟลเดอร์ปลายทาง:</span>
        </div>
        <div className="folder-display" title={folder.path}>
          <span className="folder-path">{folder.path || "ยังไม่ได้เลือกโฟลเดอร์"}</span>
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
        <div className="format-toggle" role="group" aria-label="รูปแบบไฟล์ภาพ">
          <span className="section-title">รูปแบบไฟล์:</span>
          {(["jpg", "png"] as ImageFormat[]).map((fmt) => (
            <label key={fmt} className={`format-btn ${media.imageFormat === fmt ? "selected" : ""}`}>
              <input
                type="radio"
                name="image-format"
                value={fmt}
                checked={media.imageFormat === fmt}
                onChange={() => media.onSelectFormat(fmt)}
              />
              {fmt.toUpperCase()}
            </label>
          ))}
          <span className="format-hint">
            {media.imageFormat === "png"
              ? "PNG: ไม่บีบอัดสี (ไฟล์ใหญ่กว่า)"
              : "JPG: ขนาดเล็ก (คุณภาพสูง)"}
          </span>
        </div>
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
              <button type="button" className="btn btn-danger btn-sm" onClick={actions.onCancel}>
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
              <span>{session.progress?.progress ? `${session.progress.progress.toFixed(1)}%` : "0%"}</span>
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
                {session.savedFile && <div className="saved-file-name">{session.savedFile}</div>}
              </div>
            </div>
            <div className="completed-actions">
              <button type="button" className="btn btn-secondary" onClick={folder.onOpen}>
                <FolderOpen size={16} />
                เปิดโฟลเดอร์
              </button>
              {actions.onReset && (
                <button type="button" className="btn btn-primary" onClick={actions.onReset}>
                  ดาวน์โหลดอีกครั้ง
                </button>
              )}
            </div>
          </div>
        ) : media.type === "video" ? (
          <div className="video-primary-action">
            {/* Recommended video quality */}
            {(() => {
              const videoQualities = media.details.qualities.filter(
                (q) => q.id !== "audio" && q.id !== "thumbnail",
              );
              const audioQuality = media.details.qualities.find((q) => q.id === "audio");
              const thumbnailQuality = media.details.qualities.find((q) => q.id === "thumbnail");
              const extraQualities = [...videoQualities.slice(1), audioQuality, thumbnailQuality].filter(
                Boolean,
              ) as QualityOption[];
              const selectedQuality = media.details.qualities.find(
                (q) => q.id === media.selectedQualityId,
              );

              return (
                <>
                  {videoQualities.length > 0 && (
                    <div className="recommended-quality-row">
                      {videoQualities.slice(0, 1).map((q) => (
                        <label
                          key={q.id}
                          className={`quality-card quality-card--recommended ${media.selectedQualityId === q.id ? "selected" : ""}`}
                          onClick={() => {
                            if (!isDownloading) media.onSelectQuality(q.id);
                          }}
                        >
                          <input
                            type="radio"
                            name="quality"
                            value={q.id}
                            checked={media.selectedQualityId === q.id}
                            onChange={() => media.onSelectQuality(q.id)}
                            disabled={isDownloading}
                          />
                          <div className="quality-icon">
                            <Film size={20} />
                          </div>
                          <div className="quality-details">
                            <span className="quality-label">{q.label}</span>
                            <span className="quality-ext">
                              {q.ext.toUpperCase()}
                              {q.filesize_approx ? (
                                <span className="quality-filesize">
                                  {" "}
                                  ({formatBytes(q.filesize_approx)})
                                </span>
                              ) : null}
                            </span>
                          </div>
                          {media.selectedQualityId === q.id && (
                            <div className="quality-check">
                              <Check size={14} />
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="download-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-lg download-btn"
                      onClick={actions.onStart}
                      disabled={session.isBusy || !selectedQuality || session.status !== "ready"}
                    >
                      <ArrowDown size={18} />
                      {selectedQuality?.ext === "mp3"
                        ? "ดาวน์โหลดเสียง MP3"
                        : selectedQuality?.ext === "jpg"
                          ? "บันทึกภาพปก"
                          : "ดาวน์โหลดวิดีโอ"}{" "}
                      {selectedQuality?.filesize_approx
                        ? `(${formatBytes(selectedQuality.filesize_approx)})`
                        : ""}
                    </button>
                    {folder.path && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={folder.onOpen}
                        title="เปิดโฟลเดอร์ปลายทาง"
                      >
                        <FolderOpen size={16} />
                        เปิดโฟลเดอร์
                      </button>
                    )}
                  </div>

                  {/* Collapsible extras */}
                  {extraQualities.length > 0 && (
                    <div className="extras-section">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm extras-toggle"
                        onClick={() => setShowExtras((v) => !v)}
                        aria-expanded={showExtras}
                      >
                        {showExtras ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        ตัวเลือกเพิ่มเติม
                      </button>
                      {showExtras && (
                        <div className="quality-grid">
                          {extraQualities.map((q) => {
                            const isSelected = media.selectedQualityId === q.id;
                            const isAudio = q.ext === "mp3";
                            const isImage = q.ext === "jpg";
                            return (
                              <label
                                key={q.id}
                                className={`quality-card ${isSelected ? "selected" : ""}`}
                                onClick={() => {
                                  if (!isDownloading) media.onSelectQuality(q.id);
                                }}
                              >
                                <input
                                  type="radio"
                                  name="quality"
                                  value={q.id}
                                  checked={isSelected}
                                  onChange={() => media.onSelectQuality(q.id)}
                                  disabled={isDownloading}
                                />
                                <div className="quality-icon">
                                  {isImage ? (
                                    <ImageIcon size={20} />
                                  ) : isAudio ? (
                                    <FileAudio size={20} />
                                  ) : (
                                    <Film size={20} />
                                  )}
                                </div>
                                <div className="quality-details">
                                  <span className="quality-label">{q.label}</span>
                                  <span className="quality-ext">
                                    {q.ext.toUpperCase()}
                                    {q.filesize_approx ? (
                                      <span className="quality-filesize">
                                        {" "}
                                        ({formatBytes(q.filesize_approx)})
                                      </span>
                                    ) : null}
                                  </span>
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
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="download-actions">
            {(() => {
              const selectedCount = media.selectedIndices
                ? media.selectedIndices.length
                : media.details.images.length;
              return (
                <button
                  type="button"
                  className="btn btn-primary btn-lg download-btn"
                  onClick={actions.onStart}
                  disabled={session.isBusy || session.status !== "ready" || selectedCount === 0}
                >
                  <ArrowDown size={18} />
                  {selectedCount === 0
                    ? "กรุณาเลือกรูปภาพอย่างน้อย 1 รูป"
                    : selectedCount === media.details.images.length
                    ? `ดาวน์โหลดรูปทั้งหมด (${selectedCount} ใบ · ${media.imageFormat.toUpperCase()})`
                    : `ดาวน์โหลดรูปที่เลือก (${selectedCount} จาก ${media.details.images.length} ใบ · ${media.imageFormat.toUpperCase()})`}
                </button>
              );
            })()}
            {folder.path && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={folder.onOpen}
                title="เปิดโฟลเดอร์ปลายทาง"
              >
                <FolderOpen size={16} />
                เปิดโฟลเดอร์
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
