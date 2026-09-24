import { ArrowDown, Check, FolderOpen, Image as ImageIcon } from "lucide-react";
import type { PhotoAlbumDetails } from "../models";
import type { ActionConfig, FolderConfig, ImageFormat, SessionConfig } from "./MediaResultCard";

export interface PhotoResultHeaderProps {
  details: PhotoAlbumDetails;
  platform: string;
  selectedIndices?: number[];
  onToggleIndex?: (index: number) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  isDownloading: boolean;
}

export function PhotoResultHeader({
  details,
  platform,
  selectedIndices,
  onToggleIndex,
  onSelectAll,
  onDeselectAll,
  isDownloading,
}: PhotoResultHeaderProps) {
  return (
    <>
      <div className="photo-summary">
        <div className="video-info">
          <div className="video-channel">
            <span className="platform-badge">{platform}</span>
            {details.channel && <span className="channel-name">{details.channel}</span>}
          </div>
          <h2 className="video-title">{details.title}</h2>
          <span className="photo-count">
            <ImageIcon size={14} />
            {details.images.length > 0 ? `${details.images.length} รูป` : "โพสต์รูปภาพ"}
          </span>
        </div>
      </div>

      {details.images.length > 0 && (
        <div className="photo-selection-wrapper">
          <div className="photo-selection-header">
            <span className="photo-selection-count">
              เลือกแล้ว{" "}
              <strong>
                {selectedIndices ? selectedIndices.length : details.images.length}
              </strong>{" "}
              จาก {details.images.length} รูป
            </span>
            <div className="photo-selection-btns">
              <button
                type="button"
                className="btn btn-secondary btn-sm photo-select-btn"
                onClick={onSelectAll}
                disabled={
                  isDownloading ||
                  (selectedIndices ? selectedIndices.length === details.images.length : true)
                }
              >
                เลือกทั้งหมด
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm photo-select-btn"
                onClick={onDeselectAll}
                disabled={
                  isDownloading ||
                  (selectedIndices ? selectedIndices.length === 0 : false)
                }
              >
                ล้างการเลือก
              </button>
            </div>
          </div>

          <div className="photo-strip" role="list" aria-label="รูปภาพในโพสต์">
            {details.images.map((img, idx) => {
              const isSelected = selectedIndices ? selectedIndices.includes(idx) : true;
              return (
                <div
                  key={img.index}
                  className={`photo-strip-item ${
                    isSelected ? "selected-photo" : "unselected-photo"
                  }`}
                  role="listitem"
                  onClick={() => {
                    if (!isDownloading && onToggleIndex) {
                      onToggleIndex(idx);
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
  );
}

export interface PhotoFormatToggleProps {
  imageFormat: ImageFormat;
  onSelectFormat: (fmt: ImageFormat) => void;
}

export function PhotoFormatToggle({
  imageFormat,
  onSelectFormat,
}: PhotoFormatToggleProps) {
  return (
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
  );
}

export interface PhotoDownloadActionsProps {
  details: PhotoAlbumDetails;
  imageFormat: ImageFormat;
  selectedIndices?: number[];
  folder: FolderConfig;
  session: SessionConfig;
  actions: ActionConfig;
}

export function PhotoDownloadActions({
  details,
  imageFormat,
  selectedIndices,
  folder,
  session,
  actions,
}: PhotoDownloadActionsProps) {
  const selectedCount = selectedIndices ? selectedIndices.length : details.images.length;

  return (
    <div className="download-actions">
      <button
        type="button"
        className="btn btn-primary btn-lg download-btn"
        onClick={actions.onStart}
        disabled={session.isBusy || session.status !== "ready" || selectedCount === 0}
      >
        <ArrowDown size={18} />
        {selectedCount === 0
          ? "กรุณาเลือกรูปภาพอย่างน้อย 1 รูป"
          : selectedCount === details.images.length
          ? `ดาวน์โหลดรูปทั้งหมด (${selectedCount} ใบ · ${imageFormat.toUpperCase()})`
          : `ดาวน์โหลดรูปที่เลือก (${selectedCount} จาก ${details.images.length} ใบ · ${imageFormat.toUpperCase()})`}
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
  );
}
