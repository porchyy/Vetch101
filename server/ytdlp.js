import { readdirSync, existsSync, accessSync, constants, statSync } from "node:fs";
import { mkdtemp, readdir, stat, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validatePublicUrl } from "./guard.js";
import { getProxyUrl } from "./proxy.js";
import { runProcess } from "./process.js";

function detectBinary(name) {
  const env = process.env[name === "yt-dlp" ? "YTDLP_PATH" : "FFMPEG_PATH"];
  const executable = process.platform === "win32" ? name + ".exe" : name;
  const candidates = [env, ...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean).map(dir => path.join(dir.replace(/^"|"$/g, ""), executable))];
  const winget = path.join(process.env.LOCALAPPDATA ?? "", "Microsoft/WinGet/Packages");
  if (existsSync(winget)) {
    for (const entry of readdirSync(winget, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.toLowerCase().includes(name.toLowerCase())) continue;
      const root = path.join(winget, entry.name);
      candidates.push(path.join(root, name + ".exe"));
      for (const sub of readdirSync(root, { withFileTypes: true })) {
        if (sub.isDirectory()) candidates.push(path.join(root, sub.name, "bin", name + ".exe"));
      }
    }
  }
  for (const bin of candidates.filter(Boolean)) {
    try {
      accessSync(bin, constants.X_OK);
      if (statSync(bin).isFile()) return bin;
    } catch {}
  }
  return null;
}

let binaries;
export function getBinaries() {
  return (binaries ??= { ytdlp: detectBinary("yt-dlp"), ffmpeg: detectBinary("ffmpeg") });
}

export function externalHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

// TikWM Fallback for TikTok URLs (Fast, Reliable & No Watermark)
async function fetchTikTokViaTikWM(url, signal) {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
    });

    const json = await res.json();
    if (json && json.code === 0 && json.data) {
      const d = json.data;
      const qualities = [];

      const noWatermarkUrl = externalHttpUrl(d.play);
      const watermarkUrl = externalHttpUrl(d.wmplay);
      const audioUrl = externalHttpUrl(d.music);
      if (noWatermarkUrl) {
        qualities.push({
          id: "no_watermark",
          label: "ไม่มีลายน้ำ (MP4 HD)",
          format_spec: "best",
          ext: "mp4",
          direct_url: noWatermarkUrl,
        });
      }
      if (watermarkUrl) {
        qualities.push({
          id: "watermark",
          label: "มีลายน้ำ (MP4)",
          format_spec: "best",
          ext: "mp4",
          direct_url: watermarkUrl,
        });
      }
      if (audioUrl) {
        qualities.push({
          id: "mp3",
          label: "เสียงเพลง MP3",
          format_spec: "bestaudio/best",
          ext: "mp3",
          direct_url: audioUrl,
        });
      }

      return {
        id: String(d.id || Date.now()),
        title: d.title || "TikTok Video",
        thumbnail: d.cover || d.origin_cover || "",
        duration: d.duration || 0,
        channel: d.author?.nickname || d.author?.unique_id || "TikTok Creator",
        platform: "TikTok",
        qualities,
      };
    }
  } catch (err) {
    console.warn("TikWM API fallback attempt failed:", err.message);
  }
  return null;
}

// Only native HTTP downloaders may access the network through our checked proxy.
const nativeProtocol = /^(https?|m3u8_native|http_dash_segments)$/;
export function buildQualities(data, hasFfmpeg) {
  const formats = (data.formats ?? [data]).filter(
    (f) => nativeProtocol.test(f.protocol ?? "https") && /^[\w.-]+$/.test(f.format_id ?? ""),
  );
  const videos = formats
    .filter((f) => f.vcodec !== "none")
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0));
  const audio = formats
    .filter((f) => f.vcodec === "none" && f.acodec !== "none")
    .sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0))[0];
  const qualities = [];
  const heights = new Set();
  for (const video of videos) {
    if (heights.has(video.height) || qualities.length >= 4) continue;
    const separate = video.acodec === "none";
    if (separate && (!hasFfmpeg || !audio)) continue;
    if (!hasFfmpeg && !["mp4", "webm"].includes(video.ext)) continue;
    heights.add(video.height);
    qualities.push({
      id: video.format_id,
      label: video.height ? video.height + "p" : "ต้นฉบับ",
      ext: hasFfmpeg ? "mp4" : video.ext,
      format_spec: video.format_id + (separate ? "+" + audio.format_id : ""),
    });
  }
  const source = audio ?? videos.find((f) => f.acodec !== "none");
  if (hasFfmpeg && source)
    qualities.push({ id: "mp3", label: "เฉพาะเสียง", ext: "mp3", format_spec: source.format_id });
  return qualities;
}

async function commonArgs() {
  return [
    "--ignore-config",
    "--encoding",
    "utf-8",
    "--no-playlist",
    "--playlist-items",
    "1",
    "--no-warnings",
    "--socket-timeout",
    "20",
    "--retries",
    "2",
    "--proxy",
    await getProxyUrl(),
    "--js-runtimes",
    "node:" + process.execPath,
  ];
}

export async function fetchMetadata(rawUrl, signal) {
  const url = await validatePublicUrl(rawUrl);
  if (/(^|\.)tiktok\.com$/.test(new URL(url).hostname)) {
    const result = await fetchTikTokViaTikWM(url, signal);
    if (result?.qualities.length) return result;
  }
  const { ytdlp, ffmpeg } = getBinaries();
  if (!ytdlp) throw new Error("ไม่พบ yt-dlp กรุณาติดตั้งหรือกำหนด YTDLP_PATH แล้วเริ่มเซิร์ฟเวอร์ใหม่");
  const output = await runProcess(ytdlp, [...(await commonArgs()), "--dump-single-json", "--", url], { signal });
  const data = JSON.parse(output);
  if (data.is_live) throw new Error("ยังไม่รองรับวิดีโอที่กำลังไลฟ์ กรุณารอให้ไลฟ์จบก่อน");
  const qualities = buildQualities(data, Boolean(ffmpeg));
  if (!qualities.length) throw new Error("ไม่พบรูปแบบที่ดาวน์โหลดได้ ลองติดตั้ง FFmpeg หรือลิงก์อื่น");
  return {
    id: String(data.id),
    title: data.title || "Video",
    thumbnail: data.thumbnail || "",
    duration: data.duration,
    channel: data.uploader || data.channel,
    platform: data.extractor_key || "Web",
    qualities,
  };
}

const sizeMatch = /^(\d+)([KMG]?)$/i.exec(process.env.MAX_FILESIZE ?? "500M");
export const MAX_BYTES = sizeMatch
  ? Number(sizeMatch[1]) * 1024 ** { "": 0, K: 1, M: 2, G: 3 }[sizeMatch[2].toUpperCase()]
  : 500 * 1024 ** 2;

export async function prepareDownload(rawUrl, selected, signal) {
  const url = await validatePublicUrl(rawUrl);
  const { ytdlp, ffmpeg } = getBinaries();
  if (!ytdlp) throw new Error("ไม่พบ yt-dlp ในเซิร์ฟเวอร์");
  if (selected.ext === "mp3" && !ffmpeg) throw new Error("ต้องติดตั้ง FFmpeg เพื่อแปลง MP3");
  const directory = await mkdtemp(path.join(tmpdir(), "vetch101-"));
  const cleanup = () => rm(directory, { recursive: true, force: true, maxRetries: 3 });
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  // ponytail: polling bounds temporary disk use; use a filesystem quota for a shared public service.
  const diskCheck = setInterval(async () => {
    try {
      const files = await readdir(directory);
      const sizes = await Promise.all(files.map(async (name) => (await stat(path.join(directory, name))).size));
      if (sizes.reduce((a, b) => a + b, 0) > MAX_BYTES * 2) controller.abort(new Error("ไฟล์มีขนาดเกินกำหนด"));
    } catch {
      /* Files can disappear while FFmpeg moves its output. */
    }
  }, 1000);
  try {
    const args = [
      ...(await commonArgs()),
      "--no-simulate",
      "--no-progress",
      "--downloader",
      "native",
      "--max-filesize",
      String(MAX_BYTES),
      "--print",
      "after_move:filepath",
      "-f",
      selected.format_spec,
      "-o",
      path.join(directory, "media.%(ext)s"),
    ];
    if (ffmpeg && ffmpeg !== "ffmpeg") args.push("--ffmpeg-location", path.dirname(ffmpeg));
    if (selected.ext === "mp3") args.push("-x", "--audio-format", "mp3");
    else if (ffmpeg) args.push("--merge-output-format", "mp4", "--remux-video", "mp4");
    const output = await runProcess(ytdlp, [...args, "--", url], { signal: combined, timeoutMs: 10 * 60_000 });
    const filename = await realpath(output.trim().split(/\r?\n/).at(-1));
    const root = await realpath(directory);
    if (path.dirname(filename) !== root || path.extname(filename) !== "." + selected.ext)
      throw new Error("ชนิดไฟล์ดาวน์โหลดไม่ตรงกับที่เลือก");
    const file = await stat(filename);
    if (!file.isFile() || file.size === 0 || file.size > MAX_BYTES) throw new Error("ไฟล์ว่างหรือมีขนาดเกินกำหนด");
    return { filename, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  } finally {
    clearInterval(diskCheck);
  }
}
