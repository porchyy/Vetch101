import assert from "node:assert/strict";
import test from "node:test";
import { formatBytes } from "../src/history.ts";

test("formatBytes formats byte sizes accurately", () => {
  assert.equal(formatBytes(null), "");
  assert.equal(formatBytes(0), "");
  assert.equal(formatBytes(500), "~500 B");
  assert.equal(formatBytes(1500), "~1.5 KB");
  assert.equal(formatBytes(45_000_000), "~43 MB");
  assert.equal(formatBytes(1_500_000_000), "~1.4 GB");
});
