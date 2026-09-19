import { ArrowDown, CheckCircle2, LoaderCircle, X } from "lucide-react";
import type { UpdaterState } from "../updater-state";
import { formatBytes } from "../history";

interface UpdateBannerProps {
  state: UpdaterState;
  isDownloading: boolean;
  isInspecting: boolean;
  onStartUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ state, isDownloading, isInspecting, onStartUpdate, onDismiss }: UpdateBannerProps) {
  if (state.status === "idle" || state.status === "checking" || state.status === "dismissed") return null;
  const busy = isDownloading || isInspecting;
  return (
    <section className={`update-banner update-banner-${state.status}`} aria-label="อัปเดต Vetch101">
      <div className="update-banner-content">
        <div className="update-banner-lead" role="status">
          {state.status === "applying" ? (
            <LoaderCircle size={16} className="spin update-loading-icon" />
          ) : state.status === "downloading" ? (
            <ArrowDown size={16} className="update-loading-icon" />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <div className="update-banner-text">
            <strong>
              {state.status === "error"
                ? "การอัปเดตไม่สำเร็จ"
                : state.status === "downloading"
                ? `กำลังดาวน์โหลดอัปเดต ${state.version} (${state.progress}%)`
                : state.status === "applying"
                ? "กำลังรีสตาร์ตเพื่ออัปเดต…"
                : state.status === "ready"
                ? `อัปเดต ${state.version} พร้อมติดตั้งแล้ว`
                : `พบเวอร์ชันใหม่ (${state.version})`}
            </strong>
            <span className="update-banner-desc">
              {state.status === "error"
                ? state.message
                : state.status === "downloading"
                ? state.downloadedBytes !== undefined && state.totalBytes !== undefined
                  ? `${formatBytes(state.downloadedBytes)} จาก ${formatBytes(state.totalBytes)}`
                  : "กำลังดาวน์โหลดไฟล์อัปเดตในตัวแอป กรุณารอสักครู่…"
                : state.status === "ready"
                ? busy
                  ? "รอให้งานดาวน์โหลดหรือตรวจสอบลิงก์เสร็จก่อนอัปเดต"
                  : "เลือกรีสตาร์ตเมื่อคุณพร้อม"
                : "เตรียมดาวน์โหลดอัปเดตในตัวแอป…"}
            </span>
          </div>
        </div>
        <div className="update-banner-actions">
          {state.status === "ready" && (
            <button type="button" className="update-primary-btn" onClick={onStartUpdate} disabled={busy}>
              รีสตาร์ตเพื่ออัปเดต
            </button>
          )}
          {state.status !== "applying" && (
            <button type="button" className="update-dismiss-btn" onClick={onDismiss} aria-label="ไว้ทีหลัง" title="ไว้ทีหลัง">
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      {state.status === "downloading" && (
        <div className="update-progress-container" role="progressbar" aria-valuenow={state.progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="update-progress-bar" style={{ width: `${state.progress}%` }} />
        </div>
      )}
      {"notes" in state && state.notes && (
        <details className="update-release-notes">
          <summary>มีอะไรใหม่</summary>
          {state.notes.split(/\r?\n/).map((line, index) => {
            const heading = line.match(/^#{1,6}\s+(.+)/);
            return heading ? (
              <h4 key={index}>{heading[1]}</h4>
            ) : (
              <p key={index} style={{ whiteSpace: "pre-wrap", margin: "0.35em 0" }}>
                {line.replace(/^[-*]\s+/, "• ")}
              </p>
            );
          })}
        </details>
      )}
    </section>
  );
}
