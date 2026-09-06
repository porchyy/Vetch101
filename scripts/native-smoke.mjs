// Node 24; build tests/fixtures/ytdlp.rs into temp/native-smoke/bin/yt-dlp.exe first.
// Uses the real release WebView2/IPC and real FFmpeg with an offline yt-dlp fixture.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = path.join(project, "temp/native-smoke");
const childFile = path.join(work, "ffmpeg.pid");
const slowProbe = path.join(work, "slow-probe");
const ffmpeg = execFileSync("where.exe", ["ffmpeg"], { encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/)[0];
await mkdir(work, { recursive: true });
for (const file of ["Vetch101.exe", "WebView2Loader.dll"]) await copyFile(path.join(project, file), path.join(work, file));

async function until(check, label, milliseconds = 15000) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}
function isAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}

for (const mode of ["close", "crash"]) {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  await rm(childFile, { force: true });
  await rm(slowProbe, { force: true });
  const app = spawn(path.join(work, "Vetch101.exe"), [], {
    cwd: work, stdio: "ignore", env: { ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
      WEBVIEW2_USER_DATA_FOLDER: path.join(work, `profile-${mode}-${Date.now()}`),
      VETCH101_TEST_FFMPEG: ffmpeg, VETCH101_TEST_CHILD_PID: childFile,
      VETCH101_TEST_SLOW_PROBE: slowProbe,
    },
  });
  let socket;
  try {
    const page = await until(async () => {
      assert.equal(app.exitCode, null, "app exited before WebView became available");
      try { return (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.url.startsWith("http://tauri.localhost")); }
      catch { return false; }
    }, "release WebView2");
    console.log(`Connected to release WebView2: ${page.url}`);
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await once(socket, "open");
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      pending.get(message.id)?.(message);
    });
    async function send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
        pending.set(id, message => {
          clearTimeout(timeout); pending.delete(id);
          if (message.error) reject(new Error(JSON.stringify(message.error)));
          else resolve(message.result);
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evaluate(expression) {
      const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
      return response.result.value;
    }
    await until(() => evaluate(`!!document.getElementById('video-url') && !document.body.innerText.includes('กำลังตรวจสอบโปรแกรม')`), "rendered React UI");
    const invoke = (command, args = {}) => evaluate(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)})`);
    const downloadArgs = { url: "https://fixture.test/B", formatSpec: "bestaudio/best", downloadDir: work };
    const startDownload = async () => {
      await rm(childFile, { force: true });
      await evaluate(`window.smokeDownload = window.__TAURI_INTERNALS__.invoke('start_download', ${JSON.stringify(downloadArgs)}).then(() => 'success', String); undefined`);
      return until(async () => { try { return Number(await readFile(childFile, "utf8")); } catch { return false; } }, "real FFmpeg child");
    };
    if (mode === "close") {
      await evaluate(`window.smokeSetUrl = value => { const input = document.getElementById('video-url'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', {bubbles:true})); }; window.smokeSetUrl('https://fixture.test/A')`);
      await until(() => evaluate(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('ตรวจสอบลิงก์') && !b.disabled)`), "inspect enabled");
      await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ตรวจสอบลิงก์')).click()`);
      await until(() => evaluate(`document.body.innerText.includes('กำลังตรวจสอบ…')`), "A inspection started");
      await evaluate(`window.smokeSetUrl('https://fixture.test/B')`);
      await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ตรวจสอบลิงก์')).click()`);
      await until(() => evaluate(`document.body.innerText.includes('Fixture B')`), "B metadata");
      await delay(1600); // Deliberately exceed fixture A's delay to check an out-of-order result.
      assert.equal(await evaluate(`document.body.innerText.includes('Fixture A')`), false);
      await evaluate(`window.smokeSetUrl('https://fixture.test/C')`);
      assert.equal(await evaluate(`document.body.innerText.includes('Fixture B')`), false);
      console.log("PASS native UI: edit clears metadata; late A cannot replace B");

      await evaluate(`window.smokeUpdate = window.__TAURI_INTERNALS__.invoke('update_ytdlp').then(() => 'success', String); undefined`);
      const blockedDownload = await evaluate(`window.__TAURI_INTERNALS__.invoke('start_download', ${JSON.stringify(downloadArgs)}).then(() => 'unexpected success', String)`);
      assert.match(blockedDownload, /กำลังทำงาน/);
      assert.equal(await evaluate("window.smokeUpdate"), "success");
      const cancelledPid = await startDownload();
      assert.match(await evaluate(`window.__TAURI_INTERNALS__.invoke('update_ytdlp').then(() => 'unexpected success', String)`), /กำลังทำงาน/);
      await invoke("cancel_download");
      assert.match(await evaluate("window.smokeDownload"), /ยกเลิก/);
      await until(() => !isAlive(cancelledPid), "cancelled FFmpeg termination");
      console.log("PASS native IPC: update/download exclusion + real FFmpeg cancel");

      await rm(childFile, { force: true });
      await writeFile(slowProbe, "slow");
      await evaluate(`window.smokeDownload = window.__TAURI_INTERNALS__.invoke('start_download', ${JSON.stringify(downloadArgs)}).then(() => 'success', String); undefined`);
      await invoke("cancel_download");
      assert.match(await evaluate("window.smokeDownload"), /ยกเลิก/);
      await assert.rejects(readFile(childFile));
      await rm(slowProbe);
      console.log("PASS native IPC: cancellation during slow binary preparation prevents spawn");
      const shot = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(work, "release-ui.png"), Buffer.from(shot.data, "base64"));
    }
    const ffmpegPid = await startDownload();
    assert.ok(isAlive(ffmpegPid));
    if (mode === "crash") app.kill(); // Only owner; /T would invalidate the Job Object test.
    else execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(project, "scripts/test-portable.ps1"), "-ClosePid", String(app.pid)], { windowsHide: true });
    await until(() => app.exitCode !== null || app.signalCode !== null, "app exit", 20000);
    if (mode === "close") assert.equal(app.exitCode, 0);
    await until(() => !isAlive(ffmpegPid), `${mode} FFmpeg cleanup`);
    console.log(`PASS native ${mode} during real FFmpeg: no child left running`);
  } finally {
    socket?.close();
    if (app.exitCode === null && app.signalCode === null) {
      app.kill();
      await until(() => app.exitCode !== null || app.signalCode !== null, "test cleanup");
    }
  }
}
