import { ArrowDown, Check, FolderOpen, Image as ImageIcon } from "lucide-react";
import type { VideoMetadata } from "../video-input";

export type ImageFormat = "jpg" | "png";

interface Props {
  meta: VideoMetadata;
  platform: string;
  imageFormat: ImageFormat;
  onSelectFormat: (fmt: ImageFormat) => void;
  folder: string;
  onSelectFolder: () => void;
  onOpenFolder: () => void;
  status: string;
  progress: { progress: number; speed: string; eta: string; message: string; current?: number; total?: number } | null;
  savedFile: string | null;
  updatingYtdlp: boolean;
  onStartDownload: () => void;
  onCancelDownload: () => void;
  onDownloadAgain?: () => void;
}

export function PhotoResultCard({
  meta,
  platform,
  imageFormat,
  onSelectFormat,
  folder,
  onSelectFolder,
  onOpenFolder,
  status,
  progress,
  savedFile,
  updatingYtdlp,
  onStartDownload,
  onCancelDownload,
  onDownloadAgain,
}: Props) {
  const images = meta.images ?? [];
  const imageCount = images.length;
  const isDownloading = status === "downloading";
  const isCompleted = status === "completed";

  return (
    <section className="card result-card photo-result-card">
      {/* Header: platform + title + count */}
      <div className="photo-summary">
        <div className="video-info">
          <div className="video-channel">
            <span className="platform-badge">{platform}</span>
            {meta.channel && <span className="channel-name">{meta.channel}</span>}
          </div>
          <h2 className="video-title">{meta.title}</h2>
          <span className="photo-count">
            <ImageIcon size={14} />
            {imageCount > 0 ? `${imageCount} รูป` : "โพสต์รูปภาพ"}
          </span>
        </div>
      </div>

      {/* Image strip preview */}
      {images.length > 0 && (
        <div className="photo-strip" role="list" aria-label="รูปภาพในโพสต์">
          {images.map((img) => (
            <div key={img.index} className="photo-strip-item" role="listitem">
              <img
                src={img.preview_url}
                alt={`รูปที่ ${img.index}`}
                className="photo-strip-img"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <span className="photo-strip-index">{img.index}</span>
              {img.width && img.height && (
                <span className="photo-strip-dim">{img.width}×{img.height}</span>
              )}
            </div>
          ))}
        </div>
      )}

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
            onClick={onSelectFolder}
            disabled={isDownloading}
          >
            เปลี่ยน
          </button>
        </div>
      </div>

      {/* Format toggle: JPG / PNG */}
      {!isDownloading && !isCompleted && (
        <div className="format-toggle" role="group" aria-label="รูปแบบไฟล์ภาพ">
          <span className="section-title">รูปแบบไฟล์:</span>
          {(["jpg", "png"] as ImageFormat[]).map((fmt) => (
            <label
              key={fmt}
              className={`format-btn ${imageFormat === fmt ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="image-format"
                value={fmt}
                checked={imageFormat === fmt}
                onChange={() => onSelectFormat(fmt)}
              />
              {fmt.toUpperCase()}
            </label>
          ))}
          <span className="format-hint">
            {imageFormat === "png"
              ? "PNG: ไม่บีบอัดสี (ไฟล์ใหญ่กว่า)"
              : "JPG: ขนาดเล็ก (คุณภาพสูง)"}
          </span>
        </div>
      )}

      {/* Action area */}
      <div className="action-section">
        {isDownloading ? (
          <div className="download-progress-box">
            <div className="progress-status-row">
              <div className="progress-message">
                <span>
                  {progress?.message ||
                    (progress?.current && progress?.total
                      ? `กำลังดาวน์โหลดรูปที่ ${progress.current}/${progress.total}`
                      : "กำลังดาวน์โหลดรูปภาพ...")}
                </span>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={onCancelDownload}>
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
        ) : isCompleted ? (
          <div className="completed-box">
            <div className="completed-info">
              <Check size={20} className="text-success" />
              <div>
                <strong>{progress?.message || "ดาวน์โหลดรูปภาพสำเร็จ!"}</strong>
                {savedFile && <div className="saved-file-name">{savedFile}</div>}
              </div>
            </div>
            <div className="completed-actions">
              <button type="button" className="btn btn-secondary" onClick={onOpenFolder}>
                <FolderOpen size={16} />
                เปิดโฟลเดอร์
              </button>
              {onDownloadAgain && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onDownloadAgain}
                >
                  ดาวน์โหลดอีกครั้ง
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="download-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg download-btn"
              onClick={onStartDownload}
              disabled={updatingYtdlp || status !== "ready"}
            >
              <ArrowDown size={18} />
              ดาวน์โหลดรูป {imageCount > 0 ? `(${imageCount} ใบ · ${imageFormat.toUpperCase()})` : `(${imageFormat.toUpperCase()})`}
            </button>
            {folder && (
              <button type="button" className="btn btn-secondary" onClick={onOpenFolder} title="เปิดโฟลเดอร์ปลายทาง">
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
