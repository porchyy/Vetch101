export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'vetch101_theme';

export function resolveInitialTheme(
  stored: string | null,
  systemPrefersDark: boolean
): Theme {
  if (stored === 'dark') return 'dark';
  if (stored === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function getNextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

export function applyThemeToDom(
  theme: Theme,
  element?: { setAttribute(name: string, val: string): void } | null
): void {
  const target = element ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (target && typeof target.setAttribute === 'function') {
    target.setAttribute('data-theme', theme);
  }
}

export function saveThemeToStorage(
  theme: Theme,
  storage?: Storage | null
): void {
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (target && typeof target.setItem === 'function') {
      target.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Gracefully ignore storage quota or sandbox restrictions
  }
}

export function loadSavedTheme(storage?: Storage | null): string | null {
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (target && typeof target.getItem === 'function') {
      return target.getItem(THEME_STORAGE_KEY);
    }
  } catch {
    // Gracefully ignore storage failures
  }
  return null;
}
