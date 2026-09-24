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
import type { QualityOption, VideoDetails } from "../models";
import type { ActionConfig, FolderConfig, SessionConfig } from "./MediaResultCard";

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

export interface VideoResultHeaderProps {
  details: VideoDetails;
  platform: string;
}

export function VideoResultHeader({ details, platform }: VideoResultHeaderProps) {
  return (
    <div className="video-summary">
      <div className="thumbnail-wrapper">
        {details.thumbnail ? (
          <img
            src={details.thumbnail}
            alt={details.title}
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
        {details.duration && details.duration > 0 && (
          <span className="duration-tag">{formatDuration(details.duration)}</span>
        )}
        {details.filesize_approx ? (
          <span className="filesize-tag">{formatBytes(details.filesize_approx)}</span>
        ) : null}
      </div>

      <div className="video-info">
        <div className="video-channel">
          <span className="platform-badge">{platform}</span>
          {details.channel && <span className="channel-name">{details.channel}</span>}
        </div>
        <h2 className="video-title">{details.title}</h2>
      </div>
    </div>
  );
}

export interface VideoQualityActionsProps {
  details: VideoDetails;
  selectedQualityId: string;
  onSelectQuality: (id: string) => void;
  folder: FolderConfig;
  session: SessionConfig;
  actions: ActionConfig;
}

export function VideoQualityActions({
  details,
  selectedQualityId,
  onSelectQuality,
  folder,
  session,
  actions,
}: VideoQualityActionsProps) {
  const [showExtras, setShowExtras] = useState(false);
  const isDownloading = session.status === "downloading";

  const videoQualities = details.qualities.filter((q) => q.ext === "mp4");
  const audioQualities = details.qualities.filter(
    (q) => q.ext === "mp3" || q.ext === "wav"
  );
  const thumbnailQuality = details.qualities.find((q) => q.id === "thumbnail");
  const extraQualities = [
    ...videoQualities.slice(1),
    ...audioQualities,
    thumbnailQuality,
  ].filter(Boolean) as QualityOption[];
  const selectedQuality = details.qualities.find((q) => q.id === selectedQualityId);

  return (
    <div className="video-primary-action">
      {videoQualities.length > 0 && (
        <div className="recommended-quality-row">
          {videoQualities.slice(0, 1).map((q) => (
            <label
              key={q.id}
              className={`quality-card quality-card--recommended ${
                selectedQualityId === q.id ? "selected" : ""
              }`}
              onClick={() => {
                if (!isDownloading) onSelectQuality(q.id);
              }}
            >
              <input
                type="radio"
                name="quality"
                value={q.id}
                checked={selectedQualityId === q.id}
                onChange={() => onSelectQuality(q.id)}
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
              {selectedQualityId === q.id && (
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
          {selectedQuality?.ext === "mp3" || selectedQuality?.ext === "wav"
            ? `ดาวน์โหลดเสียง ${selectedQuality.ext.toUpperCase()}`
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
                const isSelected = selectedQualityId === q.id;
                const isAudio = q.ext === "mp3" || q.ext === "wav";
                const isImage = q.ext === "jpg";
                return (
                  <label
                    key={q.id}
                    className={`quality-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      if (!isDownloading) onSelectQuality(q.id);
                    }}
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
    </div>
  );
}
