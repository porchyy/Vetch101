import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNewerVersion,
  createUpdaterState,
  canStartUpdate,
  UpdaterAction,
} from '../src/updater-state.ts';

test('isNewerVersion correctly compares semantic versions', () => {
  assert.equal(isNewerVersion('0.2.1', '0.2.0'), true);
  assert.equal(isNewerVersion('v0.3.0', '0.2.0'), true);
  assert.equal(isNewerVersion('1.0.0', '0.2.0'), true);
  assert.equal(isNewerVersion('0.2.0', '0.2.0'), false);
  assert.equal(isNewerVersion('0.1.9', '0.2.0'), false);
  assert.equal(isNewerVersion('invalid', '0.2.0'), false);
});

test('canStartUpdate rejects when a download is active', () => {
  const activeCheck = canStartUpdate({ isDownloading: true, isInspecting: false });
  assert.equal(activeCheck.allowed, false);
  assert.match(activeCheck.reason, /กำลังดาวน์โหลด/);

  const inspectingCheck = canStartUpdate({ isDownloading: false, isInspecting: true });
  assert.equal(inspectingCheck.allowed, false);
  assert.match(inspectingCheck.reason, /ตรวจสอบ/);

  const idleCheck = canStartUpdate({ isDownloading: false, isInspecting: false });
  assert.equal(idleCheck.allowed, true);
  assert.equal(idleCheck.reason, null);
});

test('updaterState handles lifecycle transitions', () => {
  let state = createUpdaterState();
  assert.equal(state.status, 'idle');

  state = UpdaterAction.check(state);
  assert.equal(state.status, 'checking');

  state = UpdaterAction.available(state, {
    version: '0.3.0',
    notes: 'New features',
    setupUrl: 'https://example.com/setup.exe',
    isInstalled: true,
  });
  assert.equal(state.status, 'available');
  if (state.status === 'available') {
    assert.equal(state.version, '0.3.0');
    assert.equal(state.isInstalled, true);
  }

  state = UpdaterAction.startDownload(state);
  assert.equal(state.status, 'downloading');
  if (state.status === 'downloading') {
    assert.equal(state.progress, 0);
  }

  state = UpdaterAction.progress(state, 45, 45000, 100000);
  assert.equal(state.status, 'downloading');
  if (state.status === 'downloading') {
    assert.equal(state.progress, 45);
    assert.equal(state.downloadedBytes, 45000);
    assert.equal(state.totalBytes, 100000);
  }

  // Progress clamping
  state = UpdaterAction.progress(state, 150);
  if (state.status === 'downloading') {
    assert.equal(state.progress, 100);
  }
  state = UpdaterAction.progress(state, -10);
  if (state.status === 'downloading') {
    assert.equal(state.progress, 0);
  }

  state = UpdaterAction.ready(state);
  assert.equal(state.status, 'ready');

  state = UpdaterAction.error(state, 'Network timeout');
  assert.equal(state.status, 'error');
  if (state.status === 'error') {
    assert.equal(state.message, 'Network timeout');
  }

  state = UpdaterAction.dismiss(state);
  assert.equal(state.status, 'dismissed');
});

test('both verified staged installed and portable updates can be applied', () => {
  // Installed flow
  const installedAvailable = UpdaterAction.available(createUpdaterState(), {version: '0.3.0', isInstalled: true});
  assert.equal(UpdaterAction.ready(installedAvailable).status, 'available');
  assert.equal(UpdaterAction.apply(installedAvailable).status, 'available');
  const installedReady = UpdaterAction.ready(UpdaterAction.startDownload(installedAvailable));
  assert.equal(UpdaterAction.apply(installedReady).status, 'applying');

  // Portable flow
  const portableAvailable = UpdaterAction.available(createUpdaterState(), {version: '0.3.0', isInstalled: false});
  assert.equal(UpdaterAction.ready(portableAvailable).status, 'available');
  assert.equal(UpdaterAction.apply(portableAvailable).status, 'available');
  const portableDownloading = UpdaterAction.startDownload(portableAvailable);
  assert.equal(portableDownloading.status, 'downloading');
  const portableReady = UpdaterAction.ready(portableDownloading);
  assert.equal(UpdaterAction.apply(portableReady).status, 'applying');
});

test('version comparison rejects malformed components', () => {
  for (const version of ['1..0', '1. 0', 'v', 'vv2.0.0', '2.invalid.0']) {
    assert.equal(isNewerVersion(version, '0.2.0'), false, version);
  }
});
