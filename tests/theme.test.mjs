import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveInitialTheme,
  getNextTheme,
  THEME_STORAGE_KEY,
  applyThemeToDom,
} from '../src/theme-manager.ts';

test('resolveInitialTheme respects stored light preference regardless of system', () => {
  assert.equal(resolveInitialTheme('light', true), 'light');
  assert.equal(resolveInitialTheme('light', false), 'light');
});

test('resolveInitialTheme respects stored dark preference regardless of system', () => {
  assert.equal(resolveInitialTheme('dark', false), 'dark');
  assert.equal(resolveInitialTheme('dark', true), 'dark');
});

test('resolveInitialTheme falls back to system preference when storage is missing or invalid', () => {
  assert.equal(resolveInitialTheme(null, true), 'dark');
  assert.equal(resolveInitialTheme(null, false), 'light');
  assert.equal(resolveInitialTheme('invalid_value', true), 'dark');
  assert.equal(resolveInitialTheme('', false), 'light');
});

test('getNextTheme toggles accurately between dark and light', () => {
  assert.equal(getNextTheme('light'), 'dark');
  assert.equal(getNextTheme('dark'), 'light');
});

test('applyThemeToDom sets data-theme attribute on target element', () => {
  const mockElement = {
    attributes: {},
    setAttribute(name, val) {
      this.attributes[name] = val;
    },
    getAttribute(name) {
      return this.attributes[name];
    },
  };

  applyThemeToDom('dark', mockElement);
  assert.equal(mockElement.getAttribute('data-theme'), 'dark');

  applyThemeToDom('light', mockElement);
  assert.equal(mockElement.getAttribute('data-theme'), 'light');
});
