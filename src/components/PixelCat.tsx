import { useState, useEffect } from "react";
import type { MascotMood } from "../mascot-state";

interface PixelCatProps {
  mood: MascotMood;
  visible: boolean;
}

const MOOD_MESSAGES: Record<MascotMood, string> = {
  idle: "เหมียว~ พักผ่อนรอลิงก์อยู่นะ",
  inspecting: "กำลังส่องลิงก์อยู่นะ แป๊บนึง...",
  downloading: "กำลังช่วยแบกไฟล์ ฮึบๆ!",
  success: "เย้! ดาวน์โหลดเสร็จแล้วนะ!",
  error: "แง้~ ลิงก์มีปัญหาหรือโหลดไม่ผ่าน",
};

export function PixelCat({ mood, visible }: PixelCatProps) {
  const [interactiveBubble, setInteractiveBubble] = useState<string | null>(null);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    let timer: number;
    if (interactiveBubble) {
      timer = window.setTimeout(() => {
        setInteractiveBubble(null);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [interactiveBubble]);

  if (!visible) return null;

  const handleClick = () => {
    setBounce(true);
    setTimeout(() => setBounce(false), 400);
    const cuteReplies = [
      "เหมียว~ สู้ๆ นะ!",
      "วางลิงก์มาได้เลย พร้อมเสมอ!",
      "วิดีโอหรือรูป ก็โหลดได้หมดเลยนะ!",
      "ง่าวว~ ขอบคุณที่แวะมาทักทาย!",
    ];
    const picked = cuteReplies[Math.floor(Math.random() * cuteReplies.length)];
    setInteractiveBubble(picked);
  };

  const currentSpeech = interactiveBubble || MOOD_MESSAGES[mood];

  return (
    <aside
      className={`pixel-cat-companion mood-${mood} ${bounce ? "cat-bouncing" : ""}`}
      onClick={handleClick}
      title="น้องแมวผู้ช่วย Vetch101 (คลิกเพื่อทักทาย)"
      aria-label="มาสคอตน้องแมวพิกเซล"
    >
      {/* Speech Bubble */}
      <div className="cat-speech-bubble" aria-live="polite">
        <span>{currentSpeech}</span>
      </div>

      {/* 16-bit Pixel Cat SVG Sprite */}
      <div className="cat-sprite-wrapper">
        <svg
          viewBox="0 0 32 32"
          width="64"
          height="64"
          className="cat-svg"
          shapeRendering="crispEdges"
        >
          {/* Shadow */}
          <ellipse cx="16" cy="29" rx="10" ry="2.5" fill="rgba(0, 0, 0, 0.15)" />

          {/* Cat Ears */}
          <polygon points="7,8 11,4 13,9" className="cat-fur-main" />
          <polygon points="25,8 21,4 19,9" className="cat-fur-main" />
          <polygon points="8,8 11,6 12,9" className="cat-ear-inner" />
          <polygon points="24,8 21,6 20,9" className="cat-ear-inner" />

          {/* Cat Head */}
          <rect x="8" y="8" width="16" height="13" rx="3" className="cat-fur-main" />

          {/* Forehead Stripe / Patch */}
          <rect x="14" y="8" width="4" height="4" className="cat-fur-accent" />

          {/* Cat Body */}
          <rect x="9" y="19" width="14" height="9" rx="2" className="cat-fur-main" />
          <rect x="12" y="21" width="8" height="6" rx="2" className="cat-belly" />

          {/* Cat Paws */}
          <rect x="10" y="27" width="4" height="2" rx="1" className="cat-paws" />
          <rect x="18" y="27" width="4" height="2" rx="1" className="cat-paws" />

          {/* Cat Tail */}
          <path
            d="M 23 25 Q 28 24 27 20 Q 28 17 26 18"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="cat-tail"
          />

          {/* Mood Variations: Eyes, Mouth & Props */}
          {mood === "idle" && (
            <g className="cat-face-idle">
              {/* Sleeping/Resting Eyes */}
              <path d="M 11 14 Q 13 16 15 14" fill="none" strokeWidth="1.5" stroke="currentColor" />
              <path d="M 17 14 Q 19 16 21 14" fill="none" strokeWidth="1.5" stroke="currentColor" />
              {/* Whiskers */}
              <line x1="5" y1="13" x2="8" y2="14" stroke="currentColor" strokeWidth="1" />
              <line x1="5" y1="16" x2="8" y2="16" stroke="currentColor" strokeWidth="1" />
              <line x1="24" y1="14" x2="27" y2="13" stroke="currentColor" strokeWidth="1" />
              <line x1="24" y1="16" x2="27" y2="16" stroke="currentColor" strokeWidth="1" />
              {/* Nose & Mouth */}
              <polygon points="15,16 17,16 16,17" fill="#ff9999" />
              <path d="M 15 17 Q 16 18 17 17" fill="none" stroke="currentColor" strokeWidth="1" />
              {/* Zzz floating */}
              <text x="23" y="10" className="cat-floating-prop cat-zzz">z</text>
            </g>
          )}

          {mood === "inspecting" && (
            <g className="cat-face-inspecting">
              {/* Big Curious Eyes */}
              <circle cx="12.5" cy="13.5" r="2.2" fill="#181715" />
              <circle cx="12" cy="13" r="0.8" fill="#ffffff" />
              <circle cx="19.5" cy="13.5" r="2.2" fill="#181715" />
              <circle cx="19" cy="13" r="0.8" fill="#ffffff" />
              {/* Whiskers */}
              <line x1="5" y1="13" x2="8" y2="14" stroke="currentColor" strokeWidth="1" />
              <line x1="24" y1="14" x2="27" y2="13" stroke="currentColor" strokeWidth="1" />
              {/* Nose & O-mouth */}
              <polygon points="15,16 17,16 16,17" fill="#ff9999" />
              <circle cx="16" cy="18" r="1" fill="none" stroke="currentColor" strokeWidth="1" />
              {/* Magnifying Glass Prop */}
              <circle cx="24" cy="12" r="3" fill="none" stroke="#e06c43" strokeWidth="1.5" />
              <line x1="26" y1="14" x2="29" y2="17" stroke="#8a857e" strokeWidth="1.8" />
            </g>
          )}

          {mood === "downloading" && (
            <g className="cat-face-downloading">
              {/* Determined Working Eyes */}
              <line x1="11" y1="13" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" />
              <line x1="21" y1="13" x2="18" y2="14" stroke="currentColor" strokeWidth="1.5" />
              {/* Whiskers */}
              <line x1="5" y1="14" x2="8" y2="15" stroke="currentColor" strokeWidth="1" />
              <line x1="24" y1="15" x2="27" y2="14" stroke="currentColor" strokeWidth="1" />
              {/* Nose & Smile */}
              <polygon points="15,16 17,16 16,17" fill="#ff9999" />
              <path d="M 14.5 17 Q 16 19 17.5 17" fill="none" stroke="currentColor" strokeWidth="1" />
              {/* Carrying Package Box */}
              <rect x="11" y="22" width="10" height="7" rx="1" fill="#df693f" />
              <line x1="16" y1="22" x2="16" y2="29" stroke="#ffffff" strokeWidth="1" />
              <line x1="11" y1="25.5" x2="21" y2="25.5" stroke="#ffffff" strokeWidth="1" />
            </g>
          )}

          {mood === "success" && (
            <g className="cat-face-success">
              {/* Joyful Eyes */}
              <path d="M 11 14 Q 13 12 15 14" fill="none" strokeWidth="1.8" stroke="currentColor" />
              <path d="M 17 14 Q 19 12 21 14" fill="none" strokeWidth="1.8" stroke="currentColor" />
              {/* Blush cheeks */}
              <circle cx="9.5" cy="16" r="1.5" fill="#ffb3ba" opacity="0.8" />
              <circle cx="22.5" cy="16" r="1.5" fill="#ffb3ba" opacity="0.8" />
              {/* Wide Happy Mouth */}
              <polygon points="15,15.5 17,15.5 16,16.5" fill="#ff9999" />
              <path d="M 14.5 17 Q 16 20 17.5 17 Z" fill="#c85a32" />
              {/* Sparkles / Heart Prop */}
              <path d="M 23 7 C 23 5, 26 5, 26 7 C 26 9, 23 11, 23 11 C 23 11, 20 9, 20 7 C 20 5, 23 5, 23 7 Z" fill="#ef4444" className="cat-floating-prop" />
              <polygon points="7,6 8,4 9,6 11,7 9,8 8,10 7,8 5,7" fill="#fbbf24" className="cat-floating-prop" />
            </g>
          )}

          {mood === "error" && (
            <g className="cat-face-error">
              {/* Dizzy / Sad Eyes */}
              <line x1="11" y1="12" x2="14" y2="15" stroke="currentColor" strokeWidth="1.5" />
              <line x1="14" y1="12" x2="11" y2="15" stroke="currentColor" strokeWidth="1.5" />
              <line x1="18" y1="12" x2="21" y2="15" stroke="currentColor" strokeWidth="1.5" />
              <line x1="21" y1="12" x2="18" y2="15" stroke="currentColor" strokeWidth="1.5" />
              {/* Wavy mouth */}
              <polygon points="15,16 17,16 16,17" fill="#ff9999" />
              <path d="M 14 18 Q 15 17 16 18 Q 17 19 18 18" fill="none" stroke="currentColor" strokeWidth="1" />
              {/* Blue Sweat Drop */}
              <path d="M 24 9 Q 25 11 24 13 Q 23 11 24 9 Z" fill="#3b82f6" className="cat-floating-prop" />
            </g>
          )}
        </svg>
      </div>
    </aside>
  );
}
