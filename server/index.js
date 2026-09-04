import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import { fetchMetadata, streamDownload, getBinaries, validateUrl } from "./ytdlp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.join(__dirname, "../dist");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend assets from dist in production
app.use(express.static(DIST_PATH));

// SSRF Protection for direct CDN stream proxying
function isSafeCdnUrl(targetUrl) {
  try {
    const u = new URL(targetUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();

    // Disallow private / local network destinations
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host.startsWith("169.254.")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Health check + dependency status
app.get("/api/health", (req, res) => {
  try {
    const bins = getBinaries();
    res.json({ ok: true, ytdlp: bins.ytdlp, ffmpeg: bins.ffmpeg ?? null });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

// POST /api/metadata — fetch video metadata
app.post("/api/metadata", async (req, res) => {
  const { url } = req.body ?? {};
  try {
    const cleanUrl = validateUrl(url);
    const data = await fetchMetadata(cleanUrl);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/download — stream video/audio to browser
app.get("/api/download", async (req, res) => {
  const { url, format, title, audio, direct_url } = req.query;
  const isAudio = audio === "1";
  const ext = isAudio ? "mp3" : "mp4";

  // Sanitize filename to prevent HTTP Response Splitting and bad characters
  const safeTitle = (title ?? "download")
    .replace(/[\r\n\0]/g, "")
    .replace(/[<>:"/\\|?*]/g, "")
    .trim()
    .slice(0, 80) || "video";

  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.${ext}`
  );
  res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");

  // 1. Direct CDN streaming (TikWM or verified CDN url)
  if (direct_url && typeof direct_url === "string") {
    if (!isSafeCdnUrl(direct_url)) {
      return res.status(400).json({ error: "ไม่อนุญาตที่อยู่ URL ดังกล่าว" });
    }

    try {
      const response = await fetch(direct_url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.tiktok.com/",
        },
      });

      if (response.ok && response.body) {
        if (response.headers.get("content-length")) {
          res.setHeader("Content-Length", response.headers.get("content-length"));
        }
        Readable.fromWeb(response.body).pipe(res);
        return;
      }
    } catch (err) {
      console.warn("Direct stream fetch failed, falling back to yt-dlp:", err.message);
    }
  }

  // 2. Standard yt-dlp streaming
  if (!url || !format) {
    return res.status(400).json({ error: "url และ format จำเป็นสำหรับการดาวน์โหลด" });
  }

  try {
    const cleanUrl = validateUrl(url);
    res.setHeader("Transfer-Encoding", "chunked");

    const proc = streamDownload(cleanUrl, format, isAudio);

    proc.stdout.pipe(res);

    proc.stderr.on("data", (d) => {
      // Progress log
      process.stdout.write(d.toString());
    });

    proc.on("error", (err) => {
      console.error("yt-dlp stream error:", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

    req.on("close", () => {
      try {
        proc.kill("SIGTERM");
      } catch {}
    });
  } catch (err) {
    if (!res.headersSent) res.status(400).json({ error: err.message });
  }
});

// SPA fallback: Any non-API route serves index.html
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(DIST_PATH, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  ✓ Vetch101 Backend ready → http://0.0.0.0:${PORT}\n`);
  try {
    const bins = getBinaries();
    console.log(`  ✓ yt-dlp: ${bins.ytdlp}`);
    console.log(`  ✓ ffmpeg: ${bins.ffmpeg ?? "none"}`);
  } catch (e) {
    console.warn(`  ✗ ${e.message}`);
  }
});
