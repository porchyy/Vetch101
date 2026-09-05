import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter, getAllowedFormat, validatePublicUrl, isPrivateIp } from "./guard.js";
import { externalHttpUrl } from "./ytdlp.js";

test("rate limiter blocks requests after its limit", () => {
  const limit = createRateLimiter({ limit: 2, windowMs: 60_000 });

  assert.equal(limit("198.51.100.1"), true);
  assert.equal(limit("198.51.100.1"), true);
  assert.equal(limit("198.51.100.1"), false);
  assert.equal(limit("198.51.100.2"), true);
});

test("only a format returned in metadata is accepted", () => {
  const qualities = [{ id: "hd", format_spec: "bestvideo+bestaudio/best" }];

  assert.equal(getAllowedFormat(qualities, "hd"), qualities[0]);
  assert.equal(getAllowedFormat(qualities, "worst"), null);
});

test("private network URLs are rejected before DNS lookup", async () => {
  await assert.rejects(() => validatePublicUrl("http://127.0.0.1/admin"));
  await assert.rejects(() => validatePublicUrl("http://[::1]/admin"));
});

test("TikWM direct links are limited to HTTP(S)", () => {
  assert.equal(externalHttpUrl("https://cdn.example/video.mp4"), "https://cdn.example/video.mp4");
  assert.equal(externalHttpUrl("javascript:alert(1)"), null);
});

test("public hostnames reach DNS and mixed private answers are rejected", async () => {
  let hostname;
  const resolve = async (host) => {
    hostname = host;
    return [{ address: "8.8.8.8" }];
  };
  assert.equal(
    await validatePublicUrl("https://www.youtube.com/watch?v=test", resolve),
    "https://www.youtube.com/watch?v=test",
  );
  assert.equal(hostname, "www.youtube.com");
  await assert.rejects(() =>
    validatePublicUrl("https://example.com", async () => [{ address: "8.8.8.8" }, { address: "10.0.0.1" }]),
  );
});

test("private IPv4, expanded IPv6 and mapped addresses cannot bypass validation", async () => {
  for (const address of [
    "127.0.0.1",
    "::1",
    "0:0:0:0:0:0:0:1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a00:1",
    "fe80::1",
    "fd00::1",
  ]) {
    assert.equal(isPrivateIp(address), true, address);
    await assert.rejects(() => validatePublicUrl(`http://${address.includes(":") ? `[${address}]` : address}/admin`));
  }
  assert.equal(isPrivateIp("8.8.8.8"), false);
  assert.equal(isPrivateIp("2606:4700:4700::1111"), false);
  for (const url of ["file:///etc/passwd", "https://user:pass@example.com", "http://example.com:3001/"]) {
    await assert.rejects(() => validatePublicUrl(url));
  }
});
