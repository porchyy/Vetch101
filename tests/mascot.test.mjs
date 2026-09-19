import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveMascotMood,
  toggleMascotVisibility,
  resolveInitialMascotVisibility,
} from '../src/mascot-state.ts';

test('deriveMascotMood returns idle when no action is occurring', () => {
  assert.equal(
    deriveMascotMood({
      isDownloading: false,
      isInspecting: false,
      hasError: false,
      recentSuccess: false,
    }),
    'idle'
  );
});

test('deriveMascotMood prioritizes error over other states', () => {
  assert.equal(
    deriveMascotMood({
      isDownloading: false,
      isInspecting: false,
      hasError: true,
      recentSuccess: false,
    }),
    'error'
  );
  assert.equal(
    deriveMascotMood({
      isDownloading: true,
      isInspecting: false,
      hasError: true,
      recentSuccess: false,
    }),
    'error'
  );
});

test('deriveMascotMood returns downloading when active download occurs', () => {
  assert.equal(
    deriveMascotMood({
      isDownloading: true,
      isInspecting: false,
      hasError: false,
      recentSuccess: false,
    }),
    'downloading'
  );
});

test('deriveMascotMood returns inspecting during link inspection', () => {
  assert.equal(
    deriveMascotMood({
      isDownloading: false,
      isInspecting: true,
      hasError: false,
      recentSuccess: false,
    }),
    'inspecting'
  );
});

test('deriveMascotMood returns success when recentSuccess is set and not actively working', () => {
  assert.equal(
    deriveMascotMood({
      isDownloading: false,
      isInspecting: false,
      hasError: false,
      recentSuccess: true,
    }),
    'success'
  );
});

test('toggleMascotVisibility flips boolean state', () => {
  assert.equal(toggleMascotVisibility(true), false);
  assert.equal(toggleMascotVisibility(false), true);
});

test('resolveInitialMascotVisibility defaults to true unless explicitly disabled', () => {
  assert.equal(resolveInitialMascotVisibility(null), true);
  assert.equal(resolveInitialMascotVisibility('true'), true);
  assert.equal(resolveInitialMascotVisibility('false'), false);
  assert.equal(resolveInitialMascotVisibility('invalid'), true);
});
