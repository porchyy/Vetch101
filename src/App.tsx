import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { parseVideoUrl } from "./video-url";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Clipboard,
  Clock3,
  FileAudio,
  Film,
  FolderOpen,
  Link2,
  LoaderCircle,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

interface Quality {
  id: string;
  label: string;
  ext: string;
  format_spec?: string;
  direct_url?: string;
}
interface Metadata {
  id: string;
  title: string;
  thumbnail: string;
  duration?: number;
  channel?: string;
  platform?: string;
  qualities: Quality[];
  downloadToken?: string;
}
interface Recent {
  id: string;
  title: string;
  url: string;
  platform: string;
  date: number;
  ext: string;
}
interface Progress {
  progress: number;
  status: string;
  message: string;
}
interface Health {
  ok: boolean;
  ffmpeg: boolean;
}
type Status = "idle" | "loading" | "ready" | "downloading";
const desktop = isTauri();
const storageKey = "vetch101_history_v2";

function platform(value: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    for (const [domain, name] of [
      ["youtube.com", "YouTube"],
      ["youtu.be", "YouTube"],
      ["tiktok.com", "TikTok"],
      ["facebook.com", "Facebook"],
      ["fb.watch", "Facebook"],
      ["instagram.com", "Instagram"],
      ["x.com", "X"],
      ["twitter.com", "X"],
      ["soundcloud.com", "SoundCloud"],
    ]) {
      if (host === domain || host.endsWith("." + domain)) return name;
    }
    return host;
  } catch {
    return "";
  }
}
function duration(value?: number) {
  const total = Math.max(0, Math.floor(value || 0));
  return total ? [Math.floor(total / 60), String(total % 60).padStart(2, "0")].join(":") : "";
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
async function responseError(res: Response) {
  const data = await res.json().catch(() => null);
  return new Error(
    data?.error || (res.status === 503 ? "ระบบยังไม่พร้อม กรุณาลองใหม่" : "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่"),
  );
}

export default function App() {
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [qualityId, setQualityId] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [folder, setFolder] = useState("");
  const [recent, setRecent] = useState<Recent[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved)
        ? saved
            .filter(
              (v): v is Recent =>
                v &&
                typeof v.id === "string" &&
                typeof v.url === "string" &&
                /^https?:\/\//.test(v.url) &&
                typeof v.title === "string" &&
                typeof v.date === "number" &&
                typeof v.platform === "string" &&
                typeof v.ext === "string",
            )
            .slice(0, 5)
        : [];
    } catch {
      return [];
    }
  });
  const request = useRef<AbortController | null>(null);
  const version = useRef(0);
  const sourceUrl = useRef("");
  const downloadLock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = status === "loading" || status === "downloading";
  const selected = meta?.qualities.find((q) => q.id === qualityId);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      if (desktop) {
        const data = await invoke<{ ytdlp_available: boolean; ffmpeg_available: boolean }>("check_dependencies");
        setHealth({ ok: data.ytdlp_available, ffmpeg: data.ffmpeg_available });
        const defaultFolder = await invoke<string>("get_default_download_dir");
        setFolder((previous) => previous || defaultFolder);
      } else {
        const res = await fetch("/api/health", { signal: AbortSignal.timeout(12_000) });
        const data = await res.json();
        setHealth({ ok: res.ok && data.ok, ffmpeg: data.ffmpegAvailable });
      }
    } catch {
      setHealth({ ok: false, ffmpeg: false });
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void checkHealth();
    return () => {
      version.current++;
      request.current?.abort();
    };
  }, [checkHealth]);
  useEffect(() => {
    if (!desktop) return;
    const unlisten = listen<Progress>("download-progress", (e) => setProgress(e.payload));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const clear = () => {
    if (downloadLock.current) return;
    request.current?.abort();
    version.current++;
    setUrl("");
    setMeta(null);
    setStatus("idle");
    setError("");
    setNotice("");
    input.current?.focus();
  };
  const fetchVideo = async (value: string) => {
    if (downloadLock.current) return;
    let clean: string;
    try {
      clean = parseVideoUrl(value);
    } catch (err) {
      setError(errorMessage(err));
      input.current?.focus();
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++version.current;
    setUrl(clean);
    setStatus("loading");
    setMeta(null);
    setError("");
    setNotice("");
    try {
      let data: Metadata;
      if (desktop) {
        data = await invoke<Metadata>("fetch_metadata", { url: clean });
        data.qualities = data.qualities.map((q) => ({ ...q, ext: q.format_spec === "bestaudio/best" ? "mp3" : "mp4" }));
      } else {
        const res = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: clean }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50_000)]),
        });
        if (!res.ok) throw await responseError(res);
        data = await res.json();
      }
      if (version.current !== current) return;
      sourceUrl.current = clean;
      setMeta(data);
      setQualityId(data.qualities[0]?.id || "");
      setStatus("ready");
    } catch (err) {
      if (version.current !== current) return;
      setError(controller.signal.aborted ? "ยกเลิกการตรวจลิงก์แล้ว" : errorMessage(err));
      setStatus("idle");
    }
  };
  const remember = (data: Metadata, ext: string) => {
    const original = sourceUrl.current;
    setRecent((prev) => {
      const updated = [
        { id: original, title: data.title, url: original, platform: platform(original), ext, date: Date.now() },
        ...prev.filter((x) => x.url !== original),
      ].slice(0, 5);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        /* History is optional when storage is disabled. */
      }
      return updated;
    });
  };
  const download = async () => {
    if (!meta || !selected || downloadLock.current) return;
    if (selected.direct_url) {
      try {
        const link = new URL(selected.direct_url);
        if (!["http:", "https:"].includes(link.protocol)) throw new Error();
        window.open(link.href, "_blank", "noopener,noreferrer");
        setNotice("เปิดไฟล์ต้นทางในแท็บใหม่แล้ว ใช้เมนูบันทึกของเบราว์เซอร์");
      } catch {
        setError("ลิงก์ต้นทางไม่ถูกต้อง กรุณาดึงข้อมูลใหม่");
      }
      return;
    }
    downloadLock.current = true;
    const controller = new AbortController();
    request.current = controller;
    setStatus("downloading");
    setError("");
    setNotice("");
    setProgress(null);
    try {
      if (desktop) {
        await invoke("start_download", {
          url: sourceUrl.current,
          formatSpec: selected.format_spec,
          downloadDir: folder,
        });
        setNotice("บันทึกไฟล์ในโฟลเดอร์ที่เลือกแล้ว");
      } else {
        const params = new URLSearchParams({ token: meta.downloadToken || "", quality: selected.id });
        const res = await fetch("/api/download?" + params, { signal: controller.signal });
        if (!res.ok) throw await responseError(res);
        setNotice("เตรียมไฟล์เสร็จแล้ว กำลังรับไฟล์…");
        // ponytail: Blob buffers up to the server's 500 MiB limit; stream to disk if larger files are needed.
        const blob = await res.blob();
        if (!blob.size) throw new Error("ได้รับไฟล์ว่าง กรุณาลองใหม่");
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = meta.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").slice(0, 80) + "." + selected.ext;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        setNotice("รับไฟล์ครบแล้ว ส่งให้เบราว์เซอร์บันทึกเรียบร้อย");
      }
      remember(meta, selected.ext);
    } catch (err) {
      setNotice("");
      setError(controller.signal.aborted ? "ยกเลิกการดาวน์โหลดแล้ว" : errorMessage(err));
    } finally {
      downloadLock.current = false;
      setStatus("ready");
      setProgress(null);
    }
  };
  const cancel = async () => {
    if (desktop && status === "downloading") {
      try {
        await invoke("cancel_download");
      } catch (err) {
        setError(errorMessage(err));
      }
    } else {
      request.current?.abort();
      if (status === "loading") {
        version.current++;
        setStatus("idle");
        setNotice("ยกเลิกการตรวจลิงก์แล้ว");
      }
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Vetch101 หน้าหลัก">
          <span className="brand-icon">
            <ArrowDown size={22} />
          </span>
          vetch<span className="brand-number">101</span>
          <span className="brand-dot">.</span>
        </a>
        <div className="header-right">
          <span className="mode-label">{desktop ? "DESKTOP EDITION" : "VIDEO & AUDIO DOWNLOADER"}</span>
          <button className="health-button" onClick={checkHealth} disabled={checking} title="ตรวจสอบระบบอีกครั้ง">
            <span className={health?.ok ? "status-dot online" : "status-dot"} />
            {checking ? "กำลังเชื่อมต่อ" : health?.ok ? "พร้อมใช้งาน" : "ตรวจสอบระบบ"}
            <RotateCcw size={12} />
          </button>
        </div>
      </header>
      <main>
        <section className="intro">
          <div className="eyebrow">
            <span /> A LITTLE TOOL FOR YOUR EVERYDAY
          </div>
          <h1>
            เจอคลิปที่ใช่
            <br />
            เก็บไว้
            <span className="accent-word">
              ดูทีหลัง
              <svg viewBox="0 0 240 14" aria-hidden="true">
                <path d="M3 10 Q115 -1 236 8" />
              </svg>
            </span>
          </h1>
          <p>
            วางลิงก์ เลือกรูปแบบ แล้วบันทึกไว้ในเครื่อง
            <br className="mobile-break" /> วิดีโอหรือแค่เสียงเพลงก็ได้
          </p>
        </section>
        <div className="workspace">
          <section className="download-panel" aria-label="ดาวน์โหลดวิดีโอ">
            <div className="panel-heading">
              <span className="section-kicker">01 / เริ่มจากลิงก์</span>
              <Link2 size={18} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void fetchVideo(url);
              }}
            >
              <label htmlFor="video-url">ลิงก์วิดีโอของคุณ</label>
              <div className="url-field">
                <Link2 size={18} />
                <input
                  id="video-url"
                  ref={input}
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text").trim();
                    if (!/^https?:\/\//i.test(pasted)) return;
                    e.preventDefault();
                    clear();
                    setUrl(pasted);
                  }}
                  disabled={status === "downloading"}
                  required
                  autoComplete="off"
                />
                {url ? (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="ล้างลิงก์"
                    onClick={clear}
                    disabled={status === "downloading"}
                  >
                    <X size={17} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="paste-button"
                    onClick={async () => {
                      try {
                        setUrl(await navigator.clipboard.readText());
                        input.current?.focus();
                      } catch {
                        setNotice("ใช้ Ctrl+V หรือกดค้างในช่องเพื่อวางลิงก์");
                        input.current?.focus();
                      }
                    }}
                  >
                    <Clipboard size={14} />
                    วาง
                  </button>
                )}
              </div>
              <button
                className="primary-button inspect-button"
                disabled={busy || !url.trim() || checking || !health?.ok}
              >
                {status === "loading" ? (
                  <>
                    <LoaderCircle className="spin" size={18} />
                    กำลังตรวจลิงก์…
                  </>
                ) : (
                  <>
                    ดูตัวเลือกดาวน์โหลด
                    <ArrowUpRight size={19} />
                  </>
                )}
              </button>
            </form>
            <div className="supported">
              <span>ใช้ได้กับ</span>
              <span>YouTube</span>
              <span>TikTok</span>
              <span>Instagram</span>
              <span>Facebook</span>
              <span>+ อื่น ๆ</span>
            </div>
            {!checking && !health?.ok && (
              <div className="message warning" role="alert">
                <strong>ยังเชื่อมต่อระบบดาวน์โหลดไม่ได้</strong>
                <span>
                  {desktop
                    ? "ตรวจสอบว่าติดตั้ง yt-dlp แล้ว จากนั้นกดตรวจสอบระบบ"
                    : "ตรวจสอบว่าเซิร์ฟเวอร์ทำงานและติดตั้ง yt-dlp แล้ว จากนั้นลองเชื่อมต่ออีกครั้ง"}
                </span>
                <button onClick={checkHealth}>
                  เชื่อมต่ออีกครั้ง <RotateCcw size={13} />
                </button>
              </div>
            )}
            {health?.ok && !health.ffmpeg && (
              <p className="dependency-note">ยังไม่มี FFmpeg — บางความละเอียดและการแปลง MP3 จะใช้งานไม่ได้</p>
            )}
            {error && (
              <div className="message error" role="alert">
                <strong>ยังทำรายการไม่สำเร็จ</strong>
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="message notice" role="status">
                <Check size={17} />
                <span>{notice}</span>
              </div>
            )}
            {status === "loading" && (
              <div className="loading-result" role="status">
                <div className="skeleton" />
                <div>
                  <strong>กำลังอ่านข้อมูลวิดีโอ</strong>
                  <p>บางแพลตฟอร์มอาจใช้เวลาสักครู่</p>
                  <button className="text-button" onClick={cancel}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
            {meta && (
              <div className="result">
                <div className="section-kicker">02 / เลือกไฟล์ที่ต้องการ</div>
                <div className="media-preview">
                  <div className="thumbnail">
                    {meta.thumbnail ? (
                      <img
                        src={meta.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <Film size={32} />
                    )}
                    <span>{duration(meta.duration)}</span>
                  </div>
                  <div>
                    <span className="platform-tag">{platform(sourceUrl.current) || meta.platform}</span>
                    <h2>{meta.title}</h2>
                    <p>{meta.channel || "วิดีโอจากลิงก์ของคุณ"}</p>
                  </div>
                </div>
                <fieldset disabled={status === "downloading"}>
                  <legend>รูปแบบและความละเอียด</legend>
                  <div className="quality-grid">
                    {meta.qualities.map((q) => (
                      <label key={q.id} className={qualityId === q.id ? "quality selected" : "quality"}>
                        <input
                          type="radio"
                          name="quality"
                          value={q.id}
                          checked={qualityId === q.id}
                          onChange={() => setQualityId(q.id)}
                        />
                        {q.ext === "mp3" ? <FileAudio size={20} /> : <Film size={20} />}
                        <span>
                          <strong>{q.label}</strong>
                          <small>
                            {q.ext.toUpperCase()}
                            {q.direct_url ? " · เปิดไฟล์ต้นทาง" : ""}
                          </small>
                        </span>
                        <span className="radio-mark">{qualityId === q.id && <Check size={11} />}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {desktop && (
                  <div className="folder-row">
                    <FolderOpen size={17} />
                    <span title={folder}>{folder}</span>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          const chosen = await invoke<string | null>("select_folder", { defaultDir: folder });
                          if (chosen) setFolder(chosen);
                        } catch (err) {
                          setError(errorMessage(err));
                        }
                      }}
                    >
                      เปลี่ยน
                    </button>
                  </div>
                )}
                {status === "downloading" ? (
                  <div className="download-state" role="status">
                    <div>
                      <LoaderCircle className="spin" size={18} />
                      <span>{progress?.message || "กำลังดาวน์โหลดและเตรียมไฟล์…"}</span>
                      <button className="text-button" onClick={cancel}>
                        ยกเลิก
                      </button>
                    </div>
                    {desktop && progress && (
                      <progress value={Math.min(100, Math.max(0, progress.progress))} max={100} />
                    )}
                    <small>เปิดหน้านี้ไว้จนกว่าจะรับไฟล์ครบ</small>
                  </div>
                ) : (
                  <button className="primary-button" onClick={download} disabled={!selected}>
                    {selected?.direct_url ? <ArrowUpRight size={18} /> : <ArrowDown size={18} />}
                    {selected?.direct_url ? "เปิดไฟล์ต้นทาง" : "บันทึก " + (selected?.ext.toUpperCase() || "ไฟล์")}
                  </button>
                )}
                {desktop && notice && (
                  <button
                    className="text-button open-folder"
                    onClick={async () => {
                      try {
                        await invoke("open_folder", { path: folder });
                      } catch (err) {
                        setError(errorMessage(err));
                      }
                    }}
                  >
                    <FolderOpen size={15} />
                    เปิดโฟลเดอร์
                  </button>
                )}
              </div>
            )}
            {!meta && status !== "loading" && (
              <div className="empty-result">
                <div className="file-stack" aria-hidden="true">
                  <div className="paper-back" />
                  <div className="paper-front">
                    <Film size={25} />
                    <span>YOUR NEXT SAVE</span>
                    <i />
                    <i />
                  </div>
                  <span className="file-stamp">
                    <ArrowDown size={21} />
                  </span>
                </div>
                <p>คลิปถัดไปที่จะเก็บไว้ เริ่มตรงนี้</p>
                <span>ตัวเลือกไฟล์จะแสดงหลังจากตรวจลิงก์</span>
              </div>
            )}
          </section>
          <aside className="side-column">
            <section className="how-to">
              <div className="note-heading">
                <span>ใช้ง่าย แค่ 3 ขั้นตอน</span>
                <span className="note-cross">✳</span>
              </div>
              <ol>
                <li>
                  <span>1</span>
                  <div>
                    <strong>คัดลอกลิงก์</strong>
                    <p>จากปุ่มแชร์ของวิดีโอที่คุณต้องการ</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>เลือกแบบที่ชอบ</strong>
                    <p>เก็บทั้งภาพและเสียง หรือเลือก MP3</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>เก็บไว้ในเครื่อง</strong>
                    <p>รอเตรียมไฟล์ แล้วบันทึกได้เลย</p>
                  </div>
                </li>
              </ol>
              <div className="note-footer">
                น้อยขั้นตอน มากเวลาให้คลิปโปรด
                <ArrowUpRight size={16} />
              </div>
            </section>
            <section className="small-print">
              <span>GOOD TO KNOW</span>
              <p>บางคลิปอาจต้องเข้าสู่ระบบ หรือถูกจำกัดจากต้นทาง เราจะแจ้งให้ทราบเมื่อดาวน์โหลดไม่ได้</p>
              <p>บันทึกเฉพาะสื่อที่คุณมีสิทธิ์ดาวน์โหลด</p>
            </section>
          </aside>
        </div>
        <section className="history-section" aria-labelledby="history-title">
          <div className="history-heading">
            <h2 id="history-title">
              <Clock3 size={18} />
              เก็บไว้ล่าสุด <span>{recent.length.toString().padStart(2, "0")}</span>
            </h2>
            {recent.length > 0 && (
              <button
                className="text-button"
                onClick={() => {
                  setRecent([]);
                  try {
                    localStorage.removeItem(storageKey);
                  } catch {}
                }}
              >
                <Trash2 size={14} />
                ล้างประวัติ
              </button>
            )}
          </div>
          {recent.length ? (
            <div className="history-list">
              {recent.map((item) => (
                <button
                  disabled={busy}
                  key={item.id}
                  onClick={() => {
                    void fetchVideo(item.url);
                    input.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="history-item"
                >
                  <span className="history-file">
                    {item.ext === "mp3" ? <FileAudio size={21} /> : <Film size={21} />}
                  </span>
                  <span className="history-copy">
                    <strong>{item.title}</strong>
                    <small>
                      {item.platform} · {item.ext.toUpperCase()} ·{" "}
                      {new Date(item.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <p className="history-empty">
              ยังไม่มีรายการ — ไฟล์ที่รับสำเร็จจะแสดงที่นี่ ประวัติเก็บในอุปกรณ์นี้เท่านั้น
            </p>
          )}
        </section>
      </main>
      <footer>
        <span className="footer-brand">vetch101.</span>
        <span>เครื่องมือเล็ก ๆ สำหรับสิ่งที่อยากเก็บไว้</span>
        <span>MADE FOR EVERYDAY USE ↗</span>
      </footer>
    </div>
  );
}
