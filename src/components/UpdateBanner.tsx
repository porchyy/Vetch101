import { CheckCircle2, ExternalLink, LoaderCircle, X } from "lucide-react";
import type { UpdaterState } from "../updater-state";

interface UpdateBannerProps {
  state: UpdaterState;
  isDownloading: boolean;
  isInspecting: boolean;
  onStartUpdate: () => void;
  onDismiss: () => void;
  onOpenExternalUrl: (url: string) => void;
}

export function UpdateBanner({ state, isDownloading, isInspecting, onStartUpdate, onDismiss, onOpenExternalUrl }: UpdateBannerProps) {
  if (state.status === "idle" || state.status === "checking" || state.status === "dismissed" || state.status === "downloading") return null;
  const busy = isDownloading || isInspecting;
  return (
    <section className={`update-banner update-banner-${state.status}`} aria-label="อัปเดต Vetch101">
      <div className="update-banner-content">
        <div className="update-banner-lead" role="status">
          {state.status === "applying" ? <LoaderCircle size={16} className="spin" /> : <CheckCircle2 size={16} />}
          <div className="update-banner-text">
            <strong>{state.status === "error" ? "การอัปเดตไม่สำเร็จ" : state.status === "applying" ? "กำลังรีสตาร์ทเพื่ออัปเดต…" : state.status === "ready" ? `อัปเดต ${state.version} พร้อมติดตั้งแล้ว` : `พบเวอร์ชันใหม่ (${state.version})`}</strong>
            <span className="update-banner-desc">
              {state.status === "error" ? state.message : state.isInstalled ? (busy ? "รอให้งานดาวน์โหลดหรือตรวจสอบลิงก์เสร็จก่อนอัปเดต" : "เลือกรีสตาร์ทเมื่อคุณพร้อม") : "ปิดแอปก่อนแตก ZIP ลงโฟลเดอร์ใหม่ เก็บโฟลเดอร์เดิมไว้สำรอง การตั้งค่าและประวัติในเครื่องจะยังอยู่"}
            </span>
          </div>
        </div>
        <div className="update-banner-actions">
          {state.status === "ready" && <button type="button" className="update-primary-btn" onClick={onStartUpdate} disabled={busy}>รีสตาร์ทเพื่ออัปเดต</button>}
          {state.status === "available" && !state.isInstalled && <button type="button" className="update-primary-btn" disabled={!state.portableUrl} onClick={() => state.portableUrl && onOpenExternalUrl(state.portableUrl)}><ExternalLink size={14} />ดาวน์โหลดไฟล์ Portable .zip</button>}
          {state.status !== "applying" && <button type="button" className="update-dismiss-btn" onClick={onDismiss} aria-label="ไว้ทีหลัง" title="ไว้ทีหลัง"><X size={15} /></button>}
        </div>
      </div>
      {"notes" in state && state.notes && <details className="update-release-notes"><summary>มีอะไรใหม่</summary>
        {state.notes.split(/\r?\n/).map((line, index) => {
          const heading = line.match(/^#{1,6}\s+(.+)/);
          return heading ? <h4 key={index}>{heading[1]}</h4> : <p key={index} style={{ whiteSpace: "pre-wrap", margin: "0.35em 0" }}>{line.replace(/^[-*]\s+/, "• ")}</p>;
        })}
      </details>}
    </section>
  );
}
