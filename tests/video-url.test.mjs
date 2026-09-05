// Run with: node --experimental-strip-types --test tests/video-url.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { parseVideoUrl } from "../src/video-url.ts";

test("reject concatenated links without rejecting a URL in query parameters", () => {
  const tiktok = "https://www.tiktok.com/@anpahtda/video/7663913857580092692";
  assert.equal(parseVideoUrl(` ${tiktok} `), tiktok);
  assert.throws(() => parseVideoUrl("https://www.w3schools.com/html/mov_" + tiktok), /สองอันต่อกัน/);
  assert.equal(parseVideoUrl("https://example.com/?next=https://example.org/"), "https://example.com/?next=https://example.org/");
  for (const invalid of ["javascript:alert(1)", "https://user:pass@example.com", "not a link"]) {
    assert.throws(() => parseVideoUrl(invalid));
  }
});
