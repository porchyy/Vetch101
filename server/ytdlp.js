import { spawn } from "child_process";
import { execSync } from "child_process";
import path from "path";

// Auto-detect yt-dlp binary
function detectYtdlp() {
  const candidates = [
    "yt-dlp",
    "yt-dlp.exe",
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "Microsoft/WinGet/Packages/yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe/yt-dlp.exe"
    ),
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "Programs/Python/Python311/Scripts/yt-dlp.exe"
    ),
  ];

  for (const bin of candidates) {
    try {
      execSync(`"${bin}" --version`, { stdio: "ignore" });
      return bin;
    } catch {}
  }
  return "yt-dlp";
}

// Auto-detect ffmpeg binary
function detectFfmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return "ffmpeg";
  } catch {}
  const wg = path.join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-7.1-full_build/bin/ffmpeg.exe"
  );
  try {
    execSync(`"${wg}" -version`, { stdio: "ignore" });
    return wg;
  } catch {}
  return null;
}

let YTDLP_BIN = null;
let FFMPEG_BIN = null;

export function getBinaries() {
  if (!YTDLP_BIN) YTDLP_BIN = detectYtdlp();
  if (!FFMPEG_BIN) FFMPEG_BIN = detectFfmpeg();
  return { ytdlp: YTDLP_BIN, ffmpeg: FFMPEG_BIN };
}

// Validate URL format
export function validateUrl(url) {
  if (!url || typeof url !== "string") {
    throw new Error("กรุณาระบุ URL วิดีโอ");
  }
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("URL ไม่ถูกต้อง กรุณาใส่ลิงค์ที่ขึ้นต้นด้วย http:// หรือ https://");
  }
  return trimmed;
}

// TikWM Fallback for TikTok URLs (Fast, Reliable & No Watermark)
async function fetchTikTokViaTikWM(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = await res.json();
    if (json && json.code === 0 && json.data) {
      const d = json.data;
      const qualities = [];

      if (d.play) {
        qualities.push({
          id: "no_watermark",
          label: "ไม่มีลายน้ำ (MP4 HD)",
          format_spec: "best",
          ext: "mp4",
          direct_url: d.play,
        });
      }
      if (d.wmplay) {
        qualities.push({
          id: "watermark",
          label: "มีลายน้ำ (MP4)",
          format_spec: "best",
          ext: "mp4",
          direct_url: d.wmplay,
        });
      }
      if (d.music) {
        qualities.push({
          id: "mp3",
          label: "เสียงเพลง MP3",
          format_spec: "bestaudio/best",
          ext: "mp3",
          direct_url: d.music,
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

function buildQualities(data, hasFfmpeg) {
  const formats = data.formats ?? [];
  const hasVideo = formats.some((f) => f.vcodec && f.vcodec !== "none");

  const qualities = [];

  if (hasVideo) {
    if (hasFfmpeg) {
      qualities.push({
        id: "hd",
        label: "MP4 HD (ความชัดสูง)",
        format_spec: "bestvideo+bestaudio/best",
        ext: "mp4",
      });
      qualities.push({
        id: "fhd",
        label: "Full HD (1080p)",
        format_spec: "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
        ext: "mp4",
      });
    } else {
      qualities.push({
        id: "hd",
        label: "MP4 Video",
        format_spec: "best[ext=mp4]/best",
        ext: "mp4",
      });
    }
  }

  qualities.push({
    id: "mp3",
    label: "ดาวน์โหลด MP3 (เฉพาะเสียง)",
    format_spec: "bestaudio/best",
    ext: "mp3",
  });

  return qualities;
}

export async function fetchMetadata(rawUrl) {
  const cleanUrl = validateUrl(rawUrl);
  const isTikTok = /tiktok\.com/i.test(cleanUrl);

  // 1. TikTok special handling
  if (isTikTok) {
    const tikwmResult = await fetchTikTokViaTikWM(cleanUrl);
    if (tikwmResult) return tikwmResult;
  }

  // 2. yt-dlp universal extraction
  const { ytdlp, ffmpeg } = getBinaries();

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(ytdlp, [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      "--",
      cleanUrl,
    ]);

    // 25s timeout to prevent hanging
    const timeoutTimer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      reject(new Error("การเชื่อมต่อดึงข้อมูลใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง"));
    }, 25000);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", async (code) => {
      clearTimeout(timeoutTimer);

      if (code !== 0) {
        if (isTikTok) {
          const fallback = await fetchTikTokViaTikWM(cleanUrl);
          if (fallback) return resolve(fallback);
        }

        const msg = stderr.includes("Unsupported URL")
          ? "ไม่รองรับ URL นี้ กรุณาตรวจสอบลิงค์"
          : stderr.includes("Private video")
          ? "วิดีโอนี้เป็นแบบส่วนตัว ไม่สามารถเข้าถึงได้"
          : `ไม่สามารถดึงข้อมูลได้: ${stderr.slice(0, 160)}`;
        return reject(new Error(msg));
      }

      try {
        const data = JSON.parse(stdout);
        resolve({
          id: String(data.id || Date.now()),
          title: data.title ?? "Unknown Video",
          thumbnail:
            data.thumbnail ??
            (data.thumbnails?.at(-1)?.url ?? ""),
          duration: data.duration ?? null,
          channel: data.uploader ?? data.channel ?? null,
          platform: data.extractor_key ?? data.extractor ?? "Web",
          qualities: buildQualities(data, Boolean(ffmpeg)),
        });
      } catch (e) {
        if (isTikTok) {
          const fallback = await fetchTikTokViaTikWM(cleanUrl);
          if (fallback) return resolve(fallback);
        }
        reject(new Error("ไม่สามารถประมวลผลข้อมูลวิดีโอได้"));
      }
    });
  });
}

export function streamDownload(rawUrl, formatSpec, isAudio) {
  const cleanUrl = validateUrl(rawUrl);
  const { ytdlp, ffmpeg } = getBinaries();

  const args = [
    "--no-playlist",
    "--no-warnings",
    "-f",
    formatSpec,
    "-o",
    "-",
  ];

  if (isAudio) {
    args.push("-x", "--audio-format", "mp3");
    if (ffmpeg && ffmpeg !== "ffmpeg") {
      args.push("--ffmpeg-location", path.dirname(ffmpeg));
    }
  } else {
    if (ffmpeg) {
      args.push("--merge-output-format", "mp4");
      if (ffmpeg !== "ffmpeg") {
        args.push("--ffmpeg-location", path.dirname(ffmpeg));
      }
    }
  }

  args.push("--", cleanUrl);

  const proc = spawn(ytdlp, args, { stdio: ["ignore", "pipe", "pipe"] });
  return proc;
}
