import React from "react";
import {
  Sparkles,
  ArrowDownToLine,
  ExternalLink,
  X,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import type { UpdaterState } from "../updater-state";

interface UpdateBannerProps {
  state: UpdaterState;
  isDownloading: boolean;
  isInspecting: boolean;
  onStartUpdate: () => void;
  onDismiss: () => void;
  onOpenExternalUrl: (url: string) => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  state,
  isDownloading,
  isInspecting,
  onStartUpdate,
  onDismiss,
  onOpenExternalUrl,
}) => {
  if (state.status === "idle" || state.status === "checking" || state.status === "dismissed") {
    return null;
  }

  const isBusy = isDownloading || isInspecting;

  return (
    <div className={`update-banner update-banner-${state.status}`}>
      <div className="update-banner-content">
        {state.status === "available" && (
          <>
            <div className="update-banner-lead">
              <span className="update-sparkle-icon">
                <Sparkles size={16} />
              </span>
              <div className="update-banner-text">
                <strong>พบเวอร์ชันใหม่ ({state.version})</strong>
                <span className="update-banner-desc">
                  {state.isInstalled
                    ? "พร้อมให้อัปเดตและติดตั้งทันทีในคลิกเดียว"
                    : "มีอัปเดตรองรับสำหรับตัว Portable"}
                </span>
              </div>
            </div>

            <div className="update-banner-actions">
              {state.isInstalled && state.setupUrl ? (
                <button
                  type="button"
                  className="update-primary-btn"
                  onClick={onStartUpdate}
                  disabled={isBusy}
                  title={
                    isBusy
                      ? "กำลังดาวน์โหลดไฟล์อยู่ กรุณารอให้เสร็จสิ้นก่อนเริ่มอัปเดต"
                      : "ดาวน์โหลดและเริ่มติดตั้งเวอร์ชันใหม่"
                  }
                >
                  <ArrowDownToLine size={14} />
                  อัปเดตทันที
                </button>
              ) : (
                <button
                  type="button"
                  className="update-primary-btn"
                  onClick={() =>
                    onOpenExternalUrl(
                      state.portableUrl ||
                        "https://github.com/porchyy/Vetch101/releases/latest"
                    )
                  }
                  title="เปิดหน้าดาวน์โหลดเวอร์ชันล่าสุด"
                >
                  <ExternalLink size={14} />
                  โหลดตัวล่าสุด
                </button>
              )}

              <button
                type="button"
                className="update-dismiss-btn"
                onClick={onDismiss}
                title="ไว้ทีหลัง"
              >
                <X size={15} />
              </button>
            </div>
          </>
        )}

        {state.status === "downloading" && (
          <div className="update-banner-progress-wrap">
            <div className="update-banner-lead">
              <LoaderCircle size={16} className="spin update-loading-icon" />
              <div className="update-banner-text">
                <strong>กำลังดาวน์โหลดตัวอัปเดต ({state.version})...</strong>
                <span className="update-banner-desc">
                  โปรดรอสักครู่ ระบบกำลังเตรียมตัวติดตั้ง
                </span>
              </div>
            </div>
          </div>
        )}

        {state.status === "ready" && (
          <div className="update-banner-lead">
            <CheckCircle2 size={16} className="update-success-icon" />
            <div className="update-banner-text">
              <strong>ดาวน์โหลดเสร็จแล้ว!</strong>
              <span className="update-banner-desc">
                ระบบกำลังเริ่มตัวติดตั้งและรีสตาร์ทแอป...
              </span>
            </div>
          </div>
        )}

        {state.status === "error" && (
          <>
            <div className="update-banner-lead">
              <AlertCircle size={16} className="update-error-icon" />
              <div className="update-banner-text">
                <strong>การอัปเดตไม่สำเร็จ</strong>
                <span className="update-banner-desc">{state.message}</span>
              </div>
            </div>
            <div className="update-banner-actions">
              <button
                type="button"
                className="update-dismiss-btn"
                onClick={onDismiss}
                title="ปิด"
              >
                <X size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
