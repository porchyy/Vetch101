import { spawn } from "node:child_process";

export function runProcess(command, args, { signal, timeoutMs = 30_000, maxOutputBytes = 16 * 1024 * 1024 } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let output = "",
      stderr = "",
      bytes = 0,
      failure;
    const stop = (error) => {
      if (failure) return;
      failure = error;
      if (!child.pid) return;
      if (process.platform === "win32") {
        const kill = spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { windowsHide: true, stdio: "ignore" });
        kill.on("error", () => child.kill());
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };
    const abort = () => stop(signal.reason ?? new Error("ยกเลิกแล้ว"));
    const timer = setTimeout(() => stop(new Error("ใช้เวลานานเกินไป กรุณาลองใหม่")), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxOutputBytes) stop(new Error("ข้อมูลมีขนาดเกินกำหนด"));
      else output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-4000);
    });
    child.on("error", (error) => {
      failure = error;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(stderr.trim() || `โปรแกรมดาวน์โหลดล้มเหลว (${code})`));
      else resolve(output);
    });
  });
}
