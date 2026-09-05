import { randomUUID } from "node:crypto";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAllowedFormat, createRateLimiter } from "./guard.js";
import { fetchMetadata, prepareDownload, getBinaries } from "./ytdlp.js";

const DIST_PATH = fileURLToPath(new URL("../dist", import.meta.url));
const MAX_ACTIVE_DOWNLOADS = Math.max(1, Number.parseInt(process.env.MAX_ACTIVE_DOWNLOADS ?? "2", 10) || 2);
const TOKEN_TTL = 10 * 60_000;

export function createApp(engine = { fetchMetadata, prepareDownload, getBinaries }) {
  const app = express();
  const tokens = new Map();
  const metadataLimit = createRateLimiter({ limit: 10, windowMs: 60_000 });
  const downloadLimit = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });
  let activeDownloads = 0,
    activeMetadata = 0;
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(express.static(DIST_PATH));
  const limited = (limiter) => (req, res, next) =>
    limiter(req.ip) ? next() : res.status(429).json({ error: "มีการใช้งานมากเกินไป กรุณาลองใหม่ภายหลัง" });

  app.get("/api/health", (req, res) => {
    const bins = engine.getBinaries();
    res
      .status(bins.ytdlp ? 200 : 503)
      .json({ ok: Boolean(bins.ytdlp), ytdlpAvailable: Boolean(bins.ytdlp), ffmpegAvailable: Boolean(bins.ffmpeg) });
  });

  app.post("/api/metadata", limited(metadataLimit), async (req, res) => {
    if (activeMetadata >= 4) return res.status(429).json({ error: "ระบบกำลังตรวจลิงก์หลายรายการ กรุณาลองใหม่สักครู่" });
    const controller = new AbortController();
    res.once("close", () => controller.abort());
    activeMetadata++;
    try {
      const data = await engine.fetchMetadata(req.body?.url, controller.signal);
      if (res.destroyed) return;
      for (const [token, entry] of tokens) if (entry.expiresAt <= Date.now()) tokens.delete(token);
      if (tokens.size >= 1000) return res.status(429).json({ error: "ระบบมีงานเต็มแล้ว กรุณาลองใหม่ภายหลัง" });
      const downloadToken = randomUUID();
      tokens.set(downloadToken, {
        url: req.body.url.trim(),
        title: data.title,
        qualities: data.qualities,
        expiresAt: Date.now() + TOKEN_TTL,
      });
      res.json({
        ...data,
        downloadToken,
        qualities: data.qualities.map(({ id, label, ext, direct_url }) => ({ id, label, ext, direct_url })),
      });
    } catch (error) {
      if (!res.destroyed) res.status(400).json({ error: error.message });
    } finally {
      activeMetadata--;
    }
  });

  app.get("/api/download", limited(downloadLimit), async (req, res) => {
    const entry = typeof req.query.token === "string" ? tokens.get(req.query.token) : null;
    if (!entry || entry.expiresAt <= Date.now())
      return res.status(410).json({ error: "ลิงก์ดาวน์โหลดหมดอายุ กรุณาดึงข้อมูลใหม่" });
    const selected = getAllowedFormat(entry.qualities, req.query.quality);
    if (!selected || selected.direct_url) return res.status(400).json({ error: "รูปแบบไฟล์ดาวน์โหลดไม่ถูกต้อง" });
    if (activeDownloads >= MAX_ACTIVE_DOWNLOADS)
      return res.status(429).json({ error: "มีงานดาวน์โหลดเต็มแล้ว กรุณาลองใหม่ภายหลัง" });
    const controller = new AbortController();
    res.once("close", () => controller.abort());
    activeDownloads++;
    let prepared;
    try {
      prepared = await engine.prepareDownload(entry.url, selected, controller.signal);
      if (res.destroyed) return;
      const title =
        String(entry.title)
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
          .trim()
          .slice(0, 80) || "video";
      res.setHeader("Cache-Control", "no-store");
      await new Promise((resolve) =>
        res.download(prepared.filename, title + "." + selected.ext, (error) => {
          if (error && !res.headersSent && !res.destroyed)
            res.status(500).json({ error: "ส่งไฟล์ไม่สำเร็จ กรุณาลองใหม่" });
          resolve();
        }),
      );
    } catch (error) {
      if (!res.destroyed) res.status(400).json({ error: error.message });
    } finally {
      try {
        await prepared?.cleanup();
      } catch {
        console.error("temporary_file_cleanup_failed");
      }
      activeDownloads--;
    }
  });

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "ไม่พบ API นี้" });
    res.sendFile(path.join(DIST_PATH, "index.html"), (error) => {
      if (error) next();
    });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({ error: "คำขอไม่ถูกต้องหรือระบบขัดข้อง กรุณาลองใหม่" });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3001;
  createApp().listen(
    port,
    process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
    () => {
      const bins = getBinaries();
      console.info(
        JSON.stringify({
          event: "server_ready",
          port,
          ytdlpAvailable: Boolean(bins.ytdlp),
          ffmpegAvailable: Boolean(bins.ffmpeg),
        }),
      );
    },
  );
}
