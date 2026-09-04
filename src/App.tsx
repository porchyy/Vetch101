import { useState, useRef, useCallback, useEffect } from "react";
import {
  Download,
  X,
  Loader2,
  Music,
  Film,
  Clock,
  RotateCcw,
  ClipboardPaste,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  History,
  Trash2,
  ExternalLink,
} from "lucide-react";

interface Quality {
  id: string;
  label: string;
  format_spec: string;
  ext: string;
  direct_url?: string;
}

interface VideoMetadata {
  id: string;
  title: string;
  thumbnail: string;
  duration?: number;
  channel?: string;
  platform?: string;
  qualities: Quality[];
}

interface RecentDownload {
  id: string;
  title: string;
  thumbnail: string;
  platform: string;
  date: string;
  url: string;
}

type DownloadStatus = "idle" | "loading" | "ready" | "downloading" | "error";

function formatDuration(sec?: number): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function detectPlatformFromUrl(u: string): string | null {
  const lower = u.toLowerCase();
  if (lower.includes("tiktok.com") || lower.includes("vt.tiktok")) return "TikTok";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "YouTube";
  if (lower.includes("facebook.com") || lower.includes("fb.watch")) return "Facebook";
  if (lower.includes("instagram.com")) return "Instagram";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "Twitter / X";
  if (lower.includes("soundcloud.com")) return "SoundCloud";
  if (lower.includes("bilibili.com")) return "Bilibili";
  return null;
}

const PLATFORMS = [
  { name: "TikTok", badge: "ไม่มีลายน้ำ", color: "bg-slate-900 text-white border-slate-700" },
  { name: "YouTube", badge: "HD / 4K", color: "bg-red-50 text-red-700 border-red-200" },
  { name: "Facebook", badge: "Reels / Post", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "Instagram", badge: "Reels / Video", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { name: "Twitter / X", badge: "MP4", color: "bg-slate-100 text-slate-800 border-slate-300" },
];

export default function App() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recentDownloads, setRecentDownloads] = useState<RecentDownload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // โหลดประวัติจาก localStorage
  useEffect(() => {
    try {
      const saved =
        localStorage.getItem("vetch101_recent_downloads") ||
        localStorage.getItem("dlx_recent_downloads");
      if (saved) {
        setRecentDownloads(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const saveToRecent = (meta: VideoMetadata, originalUrl: string) => {
    setRecentDownloads((prev) => {
      const filtered = prev.filter((item) => item.id !== meta.id);
      const updated = [
        {
          id: meta.id,
          title: meta.title,
          thumbnail: meta.thumbnail,
          platform: meta.platform || "Video",
          date: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          url: originalUrl,
        },
        ...filtered,
      ].slice(0, 5);

      try {
        localStorage.setItem("vetch101_recent_downloads", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecent = () => {
    setRecentDownloads([]);
    try {
      localStorage.removeItem("vetch101_recent_downloads");
      localStorage.removeItem("dlx_recent_downloads");
    } catch {}
  };

  const detectedPlatform = url ? detectPlatformFromUrl(url) : null;

  // ดึงข้อมูลวิดีโอ
  const fetchVideo = useCallback(
    async (targetUrl: string) => {
      const cleanUrl = targetUrl.trim();
      if (!cleanUrl) return;

      if (!/^https?:\/\//i.test(cleanUrl)) {
        setError("กรุณาระบุลิงค์ที่ขึ้นต้นด้วย http:// หรือ https://");
        setStatus("error");
        return;
      }

      setStatus("loading");
      setError(null);
      setMetadata(null);
      setDownloadSuccessMsg(null);

      try {
        const res = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: cleanUrl }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "ไม่สามารถดึงข้อมูลวิดีโอได้ กรุณาตรวจสอบลิงค์");
        }

        setMetadata(data);
        setStatus("ready");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดึงข้อมูล");
        setStatus("error");
      }
    },
    []
  );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchVideo(url);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        fetchVideo(text.trim());
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setUrl("");
    setMetadata(null);
    setError(null);
    setStatus("idle");
    setDownloadSuccessMsg(null);
    inputRef.current?.focus();
  };

  // สร้าง Download URL
  const getDownloadUrl = (quality: Quality) => {
    if (!metadata) return "#";
    const params = new URLSearchParams({
      url: url.trim(),
      format: quality.format_spec,
      title: metadata.title,
      audio: quality.ext === "mp3" ? "1" : "0",
    });
    if (quality.direct_url) {
      params.append("direct_url", quality.direct_url);
    }
    return `/api/download?${params.toString()}`;
  };

  // ดาวน์โหลดไฟล์ผ่านเบราว์เซอร์
  const handleDownload = (quality: Quality) => {
    if (!metadata) return;
    setActiveDownloadId(quality.id);
    setDownloadSuccessMsg(`กำลังส่งไฟล์ "${quality.label}" ไปยังเบราว์เซอร์...`);

    const dlUrl = getDownloadUrl(quality);
    const link = document.createElement("a");
    link.href = dlUrl;
    link.download = `${metadata.title}.${quality.ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    saveToRecent(metadata, url.trim());

    setTimeout(() => {
      setActiveDownloadId(null);
      setDownloadSuccessMsg("ดาวน์โหลดเริ่มต้นแล้ว! ตรวจสอบแถบดาวน์โหลดในเบราว์เซอร์ของคุณ");
    }, 2000);
  };

  // คัดลอกลิงค์ดาวน์โหลดตรง
  const handleCopyLink = async (quality: Quality) => {
    const dlUrl = window.location.origin + getDownloadUrl(quality);
    try {
      await navigator.clipboard.writeText(dlUrl);
      setCopiedId(quality.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-violet-500 selection:text-white">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-violet-200">
              <Download size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-700 via-purple-700 to-pink-600 bg-clip-text text-transparent">
                Vetch101
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 ml-1.5 px-1.5 py-0.5 bg-slate-100 rounded">
                Downloader
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ระบบพร้อมทำงาน (yt-dlp + TikWM)
            </span>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-10 pb-24 hero-glow">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-800 text-xs font-semibold mb-4 border border-violet-200">
            <Sparkles size={13} className="text-violet-600" />
            ดาวน์โหลดฟรี • ไม่มีลายน้ำ • รองรับทุกลิงค์
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            ดาวน์โหลดวิดีโอ & เพลง
            <span className="block mt-1 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
              ได้จากทุกลิงค์ในคลิกเดียว
            </span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-500">
            รองรับ TikTok (ไม่มีลายน้ำ), YouTube, Facebook, Instagram, Twitter / X และกว่า 1,000 เว็บ
          </p>
        </div>

        {/* ── Input Card ── */}
        <div className="bg-white rounded-3xl p-3 sm:p-4 shadow-xl shadow-slate-200/70 border border-slate-200/90 transition-all focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-100">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="วางลิงค์วิดีโอที่นี่ (เช่น TikTok, YouTube, Facebook, IG)..."
                className="w-full bg-transparent pl-4 pr-10 py-3.5 text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-normal outline-none"
                autoFocus
              />

              {url && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  title="ล้างข้อความ"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!url && (
                <button
                  type="button"
                  onClick={handlePaste}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition active:scale-95 border border-slate-200"
                >
                  <ClipboardPaste size={16} />
                  <span>วางลิงค์</span>
                </button>
              )}

              <button
                type="submit"
                disabled={!url.trim() || status === "loading"}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl text-white font-semibold text-sm sm:text-base shadow-lg shadow-violet-300/50 transition-all duration-200 ${
                  !url.trim() || status === "loading"
                    ? "bg-slate-300 cursor-not-allowed shadow-none"
                    : "bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:opacity-95 hover:shadow-violet-400/60 active:scale-95"
                }`}
              >
                {status === "loading" ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>กำลังดึงข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>ดาวน์โหลด</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Auto-detected platform badge */}
          {detectedPlatform && (
            <div className="pt-2 px-2 flex items-center gap-1.5 text-xs text-violet-700 font-medium animate-in fade-in">
              <Sparkles size={13} className="text-violet-500" />
              <span>ตรวจพบลิงค์: <strong>{detectedPlatform}</strong></span>
            </div>
          )}
        </div>

        {/* ── Platform Badges ── */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {PLATFORMS.map((p) => (
            <div
              key={p.name}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${p.color}`}
            >
              <span>{p.name}</span>
              <span className="opacity-70 text-[10px] font-normal">({p.badge})</span>
            </div>
          ))}
          <span className="text-xs text-slate-400 font-medium px-2 py-1">+1,000 แพลตฟอร์ม</span>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="shrink-0 text-rose-600 mt-0.5" size={20} />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-rose-900">ไม่สามารถดาวน์โหลดได้</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => fetchVideo(url)}
                  className="px-3 py-1 rounded-lg bg-rose-200/80 hover:bg-rose-300 text-rose-900 text-xs font-semibold transition"
                >
                  ลองอีกครั้ง
                </button>
                <button
                  onClick={handleClear}
                  className="px-3 py-1 rounded-lg bg-white border border-rose-200 text-rose-800 text-xs font-semibold hover:bg-rose-50 transition"
                >
                  ลองใช้ลิงค์อื่น
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading Skeleton ── */}
        {status === "loading" && (
          <div className="mt-8 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-lg shadow-slate-100 flex flex-col md:flex-row gap-6 animate-pulse">
            <div className="w-full md:w-72 aspect-video bg-slate-200 rounded-2xl shrink-0" />
            <div className="flex-1 flex flex-col justify-center space-y-4">
              <div className="h-5 bg-slate-200 rounded-lg w-3/4" />
              <div className="h-4 bg-slate-200 rounded-lg w-1/3" />
              <div className="flex flex-wrap gap-2.5 pt-2">
                <div className="h-11 w-36 bg-slate-200 rounded-xl" />
                <div className="h-11 w-32 bg-slate-200 rounded-xl" />
                <div className="h-11 w-32 bg-slate-200 rounded-xl" />
              </div>
            </div>
          </div>
        )}

        {/* ── Metadata / Result Card ── */}
        {metadata && status === "ready" && (
          <div className="mt-8 bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xl shadow-slate-200/60 transition-all animate-in fade-in slide-in-from-bottom-3">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Thumbnail */}
              <div className="relative w-full md:w-80 aspect-video rounded-2xl overflow-hidden bg-slate-900 shrink-0 shadow-md">
                {metadata.thumbnail ? (
                  <img
                    src={metadata.thumbnail}
                    alt={metadata.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <Film size={36} />
                  </div>
                )}

                {metadata.duration && metadata.duration > 0 && (
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-white text-xs font-semibold flex items-center gap-1 shadow">
                    <Clock size={11} />
                    {formatDuration(metadata.duration)}
                  </div>
                )}

                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-white/90 backdrop-blur-sm text-slate-900 text-xs font-bold shadow">
                  {metadata.platform || "Video"}
                </div>
              </div>

              {/* Details & Actions */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 line-clamp-2 leading-snug">
                    {metadata.title}
                  </h2>

                  {metadata.channel && (
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-500 inline-block"></span>
                      {metadata.channel}
                    </p>
                  )}
                </div>

                {/* Download Buttons Section */}
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                    เลือกรูปแบบไฟล์ที่ต้องการดาวน์โหลด:
                  </p>

                  <div className="flex flex-wrap gap-2.5">
                    {metadata.qualities.map((q) => {
                      const isDownloading = activeDownloadId === q.id;
                      const isMp3 = q.ext === "mp3";
                      const isNoWm = q.id === "no_watermark";
                      const isCopied = copiedId === q.id;

                      return (
                        <div key={q.id} className="flex items-center gap-1">
                          <button
                            onClick={() => handleDownload(q)}
                            disabled={isDownloading}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-xs sm:text-sm shadow-sm transition-all duration-150 active:scale-95 ${
                              isNoWm
                                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-violet-200"
                                : isMp3
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-amber-200"
                                : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200"
                            }`}
                          >
                            {isDownloading ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : isMp3 ? (
                              <Music size={16} />
                            ) : (
                              <Download size={16} />
                            )}
                            <span>{q.label}</span>
                          </button>

                          {/* Quick copy link for IDM or sharing */}
                          <button
                            onClick={() => handleCopyLink(q)}
                            title="คัดลอกลิงค์ดาวน์โหลดตรง (สำหรับ IDM หรือแชร์)"
                            className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                          >
                            {isCopied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {downloadSuccessMsg && (
                    <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span>{downloadSuccessMsg}</span>
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={handleClear}
                      className="text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1.5 transition"
                    >
                      <RotateCcw size={13} />
                      ดาวน์โหลดวิดีโอรายการอื่น
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Recent Downloads Section (If available) ── */}
        {recentDownloads.length > 0 && status === "idle" && (
          <div className="mt-12 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                <History size={16} className="text-violet-600" />
                <span>ประวัติดาวน์โหลดล่าสุด</span>
              </div>
              <button
                onClick={clearRecent}
                className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 transition"
              >
                <Trash2 size={12} />
                <span>ล้างประวัติ</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentDownloads.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setUrl(item.url);
                    fetchVideo(item.url);
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 border border-slate-100 cursor-pointer transition group"
                >
                  <div className="w-16 aspect-video rounded-lg overflow-hidden bg-slate-900 shrink-0">
                    <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1 group-hover:text-violet-600 transition">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>{item.platform}</span>
                      <span>•</span>
                      <span>{item.date}</span>
                    </div>
                  </div>
                  <ExternalLink size={13} className="text-slate-300 group-hover:text-violet-500 shrink-0 mr-1" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── How to use (Default State) ── */}
        {status === "idle" && (
          <div className="mt-12">
            <h3 className="text-center text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">
              วิธีใช้งานง่ายๆ ใน 3 ขั้นตอน
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-lg mb-3">
                  1
                </div>
                <h4 className="font-semibold text-slate-900 text-sm">คัดลอกลิงค์วิดีโอ</h4>
                <p className="text-xs text-slate-500 mt-1">
                  เปิดคลิป TikTok หรือ YouTube ที่ต้องการ แล้วกดแชร์เพื่อคัดลอกลิงค์
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg mb-3">
                  2
                </div>
                <h4 className="font-semibold text-slate-900 text-sm">วางลิงค์ในกล่องค้นหา</h4>
                <p className="text-xs text-slate-500 mt-1">
                  กดปุ่ม "วางลิงค์" ด้านบน หรือกด Ctrl + V เพื่อใส่ลิงค์ได้ทันที
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-lg mb-3">
                  3
                </div>
                <h4 className="font-semibold text-slate-900 text-sm">กดดาวน์โหลดไฟล์</h4>
                <p className="text-xs text-slate-500 mt-1">
                  เลือกความชัด MP4 ไม่มีลายน้ำ หรือแยกเฉพาะเสียงเพลง MP3
                </p>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">ไม่มีลายน้ำ 100%</p>
                  <p className="text-[11px] text-slate-500">คลิป TikTok ใส ไม่มีโลโก้บัง</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 shrink-0">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">ความเร็วสูงพิเศษ</p>
                  <p className="text-[11px] text-slate-500">ดาวน์โหลดตรงผ่าน CDN เซิร์ฟเวอร์</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                  <Music size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">แยกไฟล์เสียง MP3</p>
                  <p className="text-[11px] text-slate-500">โหลดเฉพาะเสียงเพลงคมชัด 320kbps</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center">
        <p className="text-xs text-slate-500">
          Vetch101 - Video Downloader • ขับเคลื่อนด้วย yt-dlp & TikWM • ปลอดภัย ไม่เก็บประวัติส่วนตัว
        </p>
      </footer>
    </div>
  );
}
