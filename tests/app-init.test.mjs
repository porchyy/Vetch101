import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useDownloadSession } from "../src/useDownloadSession.ts";
import { useAppUpdates } from "../src/useAppUpdates.ts";

test("App initial render: hook orchestration mounts without TDZ ReferenceError", () => {
  function AppHarness() {
    // Current setup in App.tsx
    const session = useDownloadSession({
      folder: "C:/downloads",
      isBlocked: () => updates.isUpdateBlocked,
    });

    const updates = useAppUpdates({
      folder: "C:/downloads",
      onSetFolder: () => {},
      isDownloading: session.isDownloading,
      isInspecting: session.isInspecting,
      downloadLockActive: session.downloadLockActive,
      onError: session.setError,
      onNotice: session.setNotice,
    });

    return React.createElement("div", null, `status: ${session.status}, blocked: ${updates.isUpdateBlocked}`);
  }

  // Must mount and render without throwing ReferenceError: Cannot access 'updates' before initialization
  assert.doesNotThrow(() => {
    renderToStaticMarkup(React.createElement(AppHarness));
  });
});

test("App initial render: App.tsx ref-based decoupled hook orchestration mounts cleanly", () => {
  function CleanAppHarness() {
    const sessionRef = React.useRef(null);

    const updates = useAppUpdates({
      folder: "C:/downloads",
      onSetFolder: () => {},
      getMediaStatus: () => ({
        isDownloading: sessionRef.current?.isDownloading ?? false,
        isInspecting: sessionRef.current?.isInspecting ?? false,
        downloadLockActive: sessionRef.current?.downloadLockActive ?? false,
      }),
      onError: (err) => sessionRef.current?.setError(err),
      onNotice: (notice) => sessionRef.current?.setNotice(notice),
    });

    const session = useDownloadSession({
      folder: "C:/downloads",
      isBlocked: updates.isUpdateBlocked,
    });
    sessionRef.current = session;

    return React.createElement("div", null, `status: ${session.status}, blocked: ${updates.isUpdateBlocked}`);
  }

  assert.doesNotThrow(() => {
    renderToStaticMarkup(React.createElement(CleanAppHarness));
  });
});
