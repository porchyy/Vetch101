import assert from "node:assert/strict";
import test from "node:test";
import { initialVideoInput, videoInputReducer as reduce } from "../src/video-input.ts";

test("editing or clearing A invalidates its metadata and pending success/failure", () => {
  const a = { id: "A", title: "A", thumbnail: "", qualities: [{ id: "720p" }] };
  const checking = reduce(initialVideoInput, { type: "inspect", url: "https://a.test", revision: 1 });
  const ready = reduce(checking, { type: "success", revision: 1, meta: a });
  assert.equal(ready.selectedQualityId, "720p");
  for (const previous of [checking, ready]) {
    for (const url of ["https://b.test", ""]) {
      const changed = reduce(previous, { type: "change", url });
      assert.equal(changed.meta, null);
      assert.equal(changed.selectedQualityId, "");
      assert.equal(changed.status, "idle");
      assert.equal(reduce(changed, { type: "success", revision: 1, meta: a }), changed);
      assert.equal(reduce(changed, { type: "failure", revision: 1, error: { summary: "old error" } }), changed);
    }
  }
});

test("overlapping inspections, including the same URL, accept only the newest response", async () => {
  let state = initialVideoInput;
  let completeOld;
  const oldResult = new Promise(resolve => { completeOld = resolve; });
  state = reduce(state, { type: "inspect", url: "https://a.test", revision: 1 });
  const oldRequest = oldResult.then(meta => { state = reduce(state, { type: "success", revision: 1, meta }); });
  state = reduce(state, { type: "inspect", url: "https://a.test", revision: 2 });
  const latest = { id: "new", qualities: [] };
  state = reduce(state, { type: "success", revision: 2, meta: latest });
  completeOld({ id: "old", qualities: [{ id: "stale" }] });
  await oldRequest;
  assert.equal(state.meta, latest);
  assert.equal(state.selectedQualityId, "");
  assert.equal(state.status, "ready");
});
