import assert from "node:assert/strict";
import test from "node:test";
import {
  initialSessionState,
  sessionReducer,
} from "../src/useDownloadSession.ts";

test("initial session state starts in idle status", () => {
  assert.equal(initialSessionState.status, "idle");
  assert.equal(initialSessionState.url, "");
  assert.equal(initialSessionState.meta, null);
  assert.equal(initialSessionState.selectedQualityId, "");
  assert.equal(initialSessionState.error, null);
  assert.equal(initialSessionState.progress, null);
  assert.equal(initialSessionState.savedFile, null);
});

test("change_url clears metadata, errors, notices, and increments revision", () => {
  const readyState = {
    ...initialSessionState,
    url: "https://youtube.com/watch?v=123",
    status: "ready",
    meta: {
      type: "video",
      id: "123",
      title: "Test Video",
      qualities: [{ id: "1080p", label: "1080p", format_spec: "best", ext: "mp4" }],
    },
    selectedQualityId: "1080p",
    notice: "Done",
    savedFile: "video.mp4",
    revision: 2,
  };

  const changed = sessionReducer(readyState, {
    type: "change_url",
    url: "https://youtube.com/watch?v=456",
  });

  assert.equal(changed.url, "https://youtube.com/watch?v=456");
  assert.equal(changed.status, "idle");
  assert.equal(changed.meta, null);
  assert.equal(changed.selectedQualityId, "");
  assert.equal(changed.notice, "");
  assert.equal(changed.savedFile, null);
  assert.equal(changed.revision, 3);
});

test("inspection lifecycle: start_inspect -> inspect_success auto-selects quality", () => {
  const inspecting = sessionReducer(initialSessionState, {
    type: "start_inspect",
    url: "https://youtube.com/watch?v=abc",
    revision: 1,
  });

  assert.equal(inspecting.status, "checking");
  assert.equal(inspecting.revision, 1);

  const videoMeta = {
    type: "video",
    id: "abc",
    title: "Awesome Clip",
    qualities: [
      { id: "1080p", label: "1080p HD", format_spec: "bestvideo[height<=1080]+bestaudio", ext: "mp4" },
      { id: "720p", label: "720p", format_spec: "bestvideo[height<=720]+bestaudio", ext: "mp4" },
    ],
  };

  const inspected = sessionReducer(inspecting, {
    type: "inspect_success",
    revision: 1,
    meta: videoMeta,
  });

  assert.equal(inspected.status, "ready");
  assert.equal(inspected.meta, videoMeta);
  assert.equal(inspected.selectedQualityId, "1080p");
  assert.equal(inspected.error, null);
});

test("inspection lifecycle: photo album inspection sets ready without video quality", () => {
  const inspecting = sessionReducer(initialSessionState, {
    type: "start_inspect",
    url: "https://instagram.com/p/abc",
    revision: 1,
  });

  const photoMeta = {
    type: "photo_album",
    id: "photo_1",
    title: "Trip Photos",
    images: [{ url: "https://img1.jpg", width: 800, height: 600 }],
  };

  const inspected = sessionReducer(inspecting, {
    type: "inspect_success",
    revision: 1,
    meta: photoMeta,
  });

  assert.equal(inspected.status, "ready");
  assert.equal(inspected.meta, photoMeta);
  assert.equal(inspected.selectedQualityId, "");
});

test("stale inspection responses with mismatched revisions are safely ignored", () => {
  const inspectingRev2 = sessionReducer(initialSessionState, {
    type: "start_inspect",
    url: "https://youtube.com/watch?v=new",
    revision: 2,
  });

  const staleVideoMeta = {
    type: "video",
    id: "old",
    title: "Old Clip",
    qualities: [{ id: "360p", label: "360p", format_spec: "best", ext: "mp4" }],
  };

  // Response for revision 1 arrives late
  const afterLateResponse = sessionReducer(inspectingRev2, {
    type: "inspect_success",
    revision: 1,
    meta: staleVideoMeta,
  });

  assert.equal(afterLateResponse.status, "checking");
  assert.equal(afterLateResponse.meta, null);

  // Late failure for revision 1 also ignored
  const afterLateFailure = sessionReducer(inspectingRev2, {
    type: "inspect_failure",
    revision: 1,
    error: { summary: "network error" },
  });

  assert.equal(afterLateFailure.status, "checking");
  assert.equal(afterLateFailure.error, null);
});

test("inspect_failure sets status to idle and records error", () => {
  const inspecting = sessionReducer(initialSessionState, {
    type: "start_inspect",
    url: "https://invalid.com",
    revision: 1,
  });

  const failed = sessionReducer(inspecting, {
    type: "inspect_failure",
    revision: 1,
    error: { summary: "Invalid URL", detail: "404 Not Found" },
  });

  assert.equal(failed.status, "idle");
  assert.equal(failed.error?.summary, "Invalid URL");
  assert.equal(failed.error?.detail, "404 Not Found");
});

test("download lifecycle: start_download -> progress -> success", () => {
  const readyState = {
    ...initialSessionState,
    status: "ready",
    url: "https://youtube.com/watch?v=abc",
    selectedQualityId: "720p",
  };

  const downloading = sessionReducer(readyState, { type: "start_download" });
  assert.equal(downloading.status, "downloading");
  assert.equal(downloading.error, null);

  const progressed = sessionReducer(downloading, {
    type: "download_progress",
    payload: {
      progress: 54.2,
      speed: "3.5 MB/s",
      eta: "00:15",
      status: "downloading",
      message: "Downloading video",
      filename: "Awesome Video.mp4",
    },
  });

  assert.equal(progressed.progress?.progress, 54.2);
  assert.equal(progressed.savedFile, "Awesome Video.mp4");

  const completed = sessionReducer(progressed, {
    type: "download_success",
    notice: "บันทึกไฟล์เรียบร้อยแล้ว",
    savedFile: "Awesome Video.mp4",
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.notice, "บันทึกไฟล์เรียบร้อยแล้ว");
  assert.equal(completed.savedFile, "Awesome Video.mp4");
});

test("download cancellation sets status to ready with cancellation message", () => {
  const downloading = {
    ...initialSessionState,
    status: "downloading",
  };

  const cancelled = sessionReducer(downloading, { type: "download_cancelled" });
  assert.equal(cancelled.status, "ready");
  assert.equal(cancelled.notice, "ยกเลิกการดาวน์โหลดแล้ว");
});

test("download failure sets status to ready and records error", () => {
  const downloading = {
    ...initialSessionState,
    status: "downloading",
  };

  const failed = sessionReducer(downloading, {
    type: "download_failure",
    error: { summary: "Download error", detail: "Connection timeout" },
  });

  assert.equal(failed.status, "ready");
  assert.equal(failed.error?.summary, "Download error");
});

test("reset_status returns completed session to ready state", () => {
  const completed = {
    ...initialSessionState,
    status: "completed",
    notice: "Finished!",
    progress: { progress: 100, speed: "", eta: "", status: "done", message: "" },
  };

  const reset = sessionReducer(completed, { type: "reset_status" });
  assert.equal(reset.status, "ready");
  assert.equal(reset.notice, "");
  assert.equal(reset.progress, null);
});

test("editing or clearing URL invalidates metadata and pending success/failure", () => {
  const videoMeta = {
    type: "video",
    id: "A",
    title: "Video A",
    qualities: [{ id: "720p", label: "720p", format_spec: "best", ext: "mp4" }],
  };
  const checking = sessionReducer(initialSessionState, {
    type: "start_inspect",
    url: "https://a.test",
    revision: 1,
  });
  const ready = sessionReducer(checking, {
    type: "inspect_success",
    revision: 1,
    meta: videoMeta,
  });
  assert.equal(ready.selectedQualityId, "720p");

  for (const previous of [checking, ready]) {
    for (const url of ["https://b.test", ""]) {
      const changed = sessionReducer(previous, { type: "change_url", url });
      assert.equal(changed.meta, null);
      assert.equal(changed.selectedQualityId, "");
      assert.equal(changed.status, "idle");
      // Mismatched revision response is ignored
      assert.equal(
        sessionReducer(changed, { type: "inspect_success", revision: 1, meta: videoMeta }),
        changed
      );
      assert.equal(
        sessionReducer(changed, {
          type: "inspect_failure",
          revision: 1,
          error: { summary: "old error" },
        }),
        changed
      );
    }
  }
});

test("overlapping inspections accept only the newest response", async () => {
  let state = initialSessionState;
  let completeOld;
  const oldResult = new Promise((resolve) => {
    completeOld = resolve;
  });
  state = sessionReducer(state, { type: "start_inspect", url: "https://a.test", revision: 1 });
  const oldRequest = oldResult.then((meta) => {
    state = sessionReducer(state, { type: "inspect_success", revision: 1, meta });
  });
  state = sessionReducer(state, { type: "start_inspect", url: "https://a.test", revision: 2 });
  const latest = {
    type: "video",
    id: "new",
    title: "New Video",
    qualities: [],
  };
  state = sessionReducer(state, { type: "inspect_success", revision: 2, meta: latest });
  completeOld({
    type: "video",
    id: "old",
    title: "Old Video",
    qualities: [{ id: "stale", label: "stale", format_spec: "best", ext: "mp4" }],
  });
  await oldRequest;
  assert.equal(state.meta, latest);
  assert.equal(state.selectedQualityId, "");
  assert.equal(state.status, "ready");
});

test("photo album inspection initializes all photo indices as selected", () => {
  const photoMeta = {
    type: "photo_album",
    id: "album_123",
    title: "Trip",
    images: [
      { url: "https://img1.jpg", width: 800, height: 600 },
      { url: "https://img2.jpg", width: 800, height: 600 },
      { url: "https://img3.jpg", width: 800, height: 600 },
    ],
  };

  const checking = sessionReducer(initialSessionState, {
    type: "start_inspect",
    url: "https://tiktok.com/@u/photo/123",
    revision: 1,
  });

  const ready = sessionReducer(checking, {
    type: "inspect_success",
    revision: 1,
    meta: photoMeta,
  });

  assert.deepEqual(ready.selectedPhotoIndices, [0, 1, 2]);

  // Toggle photo index
  const toggledOff = sessionReducer(ready, { type: "toggle_photo_index", index: 1 });
  assert.deepEqual(toggledOff.selectedPhotoIndices, [0, 2]);

  const toggledOn = sessionReducer(toggledOff, { type: "toggle_photo_index", index: 1 });
  assert.deepEqual(toggledOn.selectedPhotoIndices, [0, 1, 2]);

  // Deselect all
  const deselected = sessionReducer(ready, { type: "deselect_all_photos" });
  assert.deepEqual(deselected.selectedPhotoIndices, []);

  // Select all
  const selectedAll = sessionReducer(deselected, { type: "select_all_photos" });
  assert.deepEqual(selectedAll.selectedPhotoIndices, [0, 1, 2]);
});

