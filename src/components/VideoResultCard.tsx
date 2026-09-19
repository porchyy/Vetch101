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
import type { VideoMetadata, QualityOption } from "../video-input";

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

interface Props {
  meta: VideoMetadata;
  platform: string;
  selectedQualityId: string;
  onSelectQuality: (id: string) => void;
  folder: string;
  onSelectFolder: () => void;
  onOpenFolder: () => void;
  status: string;
  progress: { progress: number; speed: string; eta: string; message: string } | null;
  savedFile: string | null;
  updatingYtdlp: boolean;
  onStartDownload: () => void;
  onCancelDownload: () => void;
}

export function VideoResultCard({
  meta,
  platform,
  selectedQualityId,
  onSelectQuality,
  folder,
  onSelectFolder,
  onOpenFolder,
  status,
  progress,
  savedFile,
  updatingYtdlp,
  onStartDownload,
  onCancelDownload,
}: Props) {
  const [showExtras, setShowExtras] = useState(false);

  // Separate the recommended quality from the rest
  const recommendedId = meta.qualities.find(
    (q) => q.id !== "audio" && q.id !== "thumbnail",
  )?.id;
  const videoQualities = meta.qualities.filter(
    (q) => q.id !== "audio" && q.id !== "thumbnail",
  );
  const audioQuality = meta.qualities.find((q) => q.id === "audio");
  const thumbnailQuality = meta.qualities.find((q) => q.id === "thumbnail");
  const extraQualities = [...videoQualities.slice(1), audioQuality, thumbnailQuality].filter(
    Boolean,
  ) as QualityOption[];

  const selectedQuality = meta.qualities.find((q) => q.id === selectedQualityId);
  const isDownloading = status === "downloading";
  const isCompleted = status === "completed";

  return (
    <section className="card result-card">
      {/* Thumbnail + title */}
      <div className="video-summary">
        <div className="thumbnail-wrapper">
          {meta.thumbnail ? (
            <img
              src={meta.thumbnail}
              alt={meta.title}
              className="thumbnail-img"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="thumbnail-placeholder">
              <Film size={36} />
            </div>
          )}
          {meta.duration && meta.duration > 0 && (
            <span className="duration-tag">{formatDuration(meta.duration)}</span>
          )}
          {meta.filesize_approx ? (
            <span className="filesize-tag">{formatBytes(meta.filesize_approx)}</span>
          ) : null}
        </div>
        <div className="video-info">
          <div className="video-channel">
            <span className="platform-badge">{platform}</span>
            {meta.channel && <span className="channel-name">{meta.channel}</span>}
          </div>
          <h2 className="video-title">{meta.title}</h2>
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
            onClick={onSelectFolder}
            disabled={isDownloading}
          >
            เปลี่ยน
          </button>
        </div>
      </div>

      {/* Primary action area */}
      <div className="action-section">
        {isDownloading ? (
          <div className="download-progress-box">
            <div className="progress-status-row">
              <div className="progress-message">
                <span>{progress?.message || "กำลังดาวน์โหลดและประมวลผลไฟล์..."}</span>
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
                <strong>ดาวน์โหลดและจัดเก็บไฟล์สำเร็จ!</strong>
                {savedFile && <div className="saved-file-name">{savedFile}</div>}
              </div>
            </div>
            <div className="completed-actions">
              <button type="button" className="btn btn-secondary" onClick={onOpenFolder}>
                <FolderOpen size={16} />
                เปิดโฟลเดอร์
              </button>
            </div>
          </div>
        ) : (
          <div className="video-primary-action">
            {/* Recommended quality = first video quality, pre-selected */}
            {recommendedId && (
              <div className="recommended-quality-row">
                {videoQualities.slice(0, 1).map((q) => (
                  <label
                    key={q.id}
                    className={`quality-card quality-card--recommended ${selectedQualityId === q.id ? "selected" : ""}`}
                    onClick={() => { if (!isDownloading) onSelectQuality(q.id); }}
                  >
                    <input
                      type="radio"
                      name="quality"
                      value={q.id}
                      checked={selectedQualityId === q.id}
                      onChange={() => onSelectQuality(q.id)}
                      disabled={isDownloading}
                    />
                    <div className="quality-icon"><Film size={20} /></div>
                    <div className="quality-details">
                      <span className="quality-label">{q.label}</span>
                      <span className="quality-ext">
                        {q.ext.toUpperCase()}
                        {q.filesize_approx ? (
                          <span className="quality-filesize"> ({formatBytes(q.filesize_approx)})</span>
                        ) : null}
                      </span>
                    </div>
                    {selectedQualityId === q.id && <div className="quality-check"><Check size={14} /></div>}
                  </label>
                ))}
              </div>
            )}

            <div className="download-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg download-btn"
                onClick={onStartDownload}
                disabled={updatingYtdlp || !selectedQuality || status !== "ready"}
              >
                <ArrowDown size={18} />
                ดาวน์โหลดวิดีโอ {selectedQuality?.filesize_approx ? `(${formatBytes(selectedQuality.filesize_approx)})` : ""}
              </button>
              {folder && (
                <button type="button" className="btn btn-secondary" onClick={onOpenFolder} title="เปิดโฟลเดอร์ปลายทาง">
                  <FolderOpen size={16} />
                  เปิดโฟลเดอร์
                </button>
              )}
            </div>

            {/* Collapsible extras: other resolutions, MP3, thumbnail */}
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
                      const isSelected = selectedQualityId === q.id;
                      const isAudio = q.ext === "mp3";
                      const isImage = q.ext === "jpg";
                      return (
                        <label
                          key={q.id}
                          className={`quality-card ${isSelected ? "selected" : ""}`}
                          onClick={() => { if (!isDownloading) onSelectQuality(q.id); }}
                        >
                          <input
                            type="radio"
                            name="quality"
                            value={q.id}
                            checked={isSelected}
                            onChange={() => onSelectQuality(q.id)}
                            disabled={isDownloading}
                          />
                          <div className="quality-icon">
                            {isImage ? <ImageIcon size={20} /> : isAudio ? <FileAudio size={20} /> : <Film size={20} />}
                          </div>
                          <div className="quality-details">
                            <span className="quality-label">{q.label}</span>
                            <span className="quality-ext">
                              {q.ext.toUpperCase()}
                              {q.filesize_approx ? (
                                <span className="quality-filesize"> ({formatBytes(q.filesize_approx)})</span>
                              ) : null}
                            </span>
                          </div>
                          {isSelected && <div className="quality-check"><Check size={14} /></div>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
