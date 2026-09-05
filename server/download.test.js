import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { createApp } from "./index.js";
import { createPublicProxy } from "./proxy.js";
import { runProcess } from "./process.js";
import { buildQualities } from "./ytdlp.js";

test("process exit failures, spawn failures and cancellation are propagated", async () => {
  assert.equal(await runProcess(process.execPath, ["-e", "process.stdout.write('ok')"]), "ok");
  await assert.rejects(
    runProcess(process.execPath, ["-e", "console.error('conversion failed'); process.exit(1)"]),
    /conversion failed/,
  );
  await assert.rejects(runProcess("vetch101-nonexistent-binary", []), /ENOENT/);
  const controller = new AbortController();
  const job = runProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], { signal: controller.signal });
  controller.abort(new Error("cancelled"));
  await assert.rejects(job, /cancelled/);
});

test("formats reflect available resolutions and FFmpeg; non-HTTP protocols are excluded", () => {
  const data = {
    formats: [
      { format_id: "137", height: 1080, protocol: "https", vcodec: "h264", acodec: "none", ext: "mp4" },
      { format_id: "18", height: 360, protocol: "https", vcodec: "h264", acodec: "aac", ext: "mp4" },
      { format_id: "140", protocol: "https", vcodec: "none", acodec: "aac", abr: 128 },
      { format_id: "rtmp", height: 2160, protocol: "rtmp", vcodec: "h264", acodec: "aac" },
    ],
  };
  assert.deepEqual(
    buildQualities(data, false).map((q) => q.id),
    ["18"],
  );
  const formats = buildQualities(data, true);
  assert.deepEqual(
    formats.map((q) => q.id),
    ["137", "18", "mp3"],
  );
  assert.equal(formats[0].format_spec, "137+140");
});

test("download API returns errors before file headers and sends only prepared files", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "vetch101-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "sample.mp4");
  await writeFile(filename, "verified file bytes");
  let fail = true,
    cleaned = 0;
  const app = createApp({
    getBinaries: () => ({ ytdlp: true, ffmpeg: true }),
    fetchMetadata: async () => ({ title: "test", qualities: [{ id: "hd", ext: "mp4", format_spec: "18" }] }),
    prepareDownload: async () => {
      if (fail) throw new Error("conversion failed");
      return {
        filename,
        cleanup: async () => {
          cleaned++;
        },
      };
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  const metadata = await fetch(root + "/api/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com/video" }),
  }).then((res) => res.json());
  const url = root + `/api/download?token=${metadata.downloadToken}&quality=hd`;
  const failed = await fetch(url);
  assert.equal(failed.status, 400);
  assert.equal(failed.headers.get("content-disposition"), null);
  assert.match((await failed.json()).error, /conversion failed/);
  fail = false;
  const success = await fetch(url);
  assert.equal(success.status, 200);
  assert.match(success.headers.get("content-disposition"), /attachment/);
  assert.equal(await success.text(), "verified file bytes");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cleaned, 1);
  assert.equal((await fetch(root + "/api/download?token=invalid&quality=hd")).status, 410);
});

test("egress proxy rejects private HTTP and CONNECT destinations", async (t) => {
  const proxy = createPublicProxy().listen(0, "127.0.0.1");
  await once(proxy, "listening");
  t.after(() => {
    proxy.closeAllConnections();
    proxy.close();
  });
  const options = { host: "127.0.0.1", port: proxy.address().port };
  const status = await new Promise((resolve, reject) => {
    http
      .get({ ...options, path: "http://127.0.0.1/admin" }, (res) => {
        res.resume();
        resolve(res.statusCode);
      })
      .on("error", reject);
  });
  assert.equal(status, 403);
  const connect = await new Promise((resolve, reject) => {
    const req = http.request({ ...options, method: "CONNECT", path: "[::ffff:7f00:1]:443" });
    req.on("connect", (res, socket) => {
      socket.destroy();
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(connect, 403);
});
