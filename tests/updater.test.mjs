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

  state = UpdaterAction.progress(state, 45);
  assert.equal(state.status, 'downloading');
  if (state.status === 'downloading') {
    assert.equal(state.progress, 45);
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

test('only verified staged installed updates can be applied', () => {
  const available = UpdaterAction.available(createUpdaterState(), {version: '0.3.0', isInstalled: true});
  assert.equal(UpdaterAction.ready(available).status, 'available');
  assert.equal(UpdaterAction.apply(available).status, 'available');
  const ready = UpdaterAction.ready(UpdaterAction.startDownload(available));
  assert.equal(UpdaterAction.apply(ready).status, 'applying');
  const portable = UpdaterAction.available(createUpdaterState(), {version: '0.3.0', isInstalled: false});
  assert.equal(UpdaterAction.startDownload(portable).status, 'available');
});

test('version comparison rejects malformed components', () => {
  for (const version of ['1..0', '1. 0', 'v', 'vv2.0.0', '2.invalid.0']) {
    assert.equal(isNewerVersion(version, '0.2.0'), false, version);
  }
});
