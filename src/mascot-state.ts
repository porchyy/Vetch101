export type MascotMood = 'idle' | 'inspecting' | 'downloading' | 'success' | 'error';

export const MASCOT_STORAGE_KEY = 'vetch101_mascot_visible';

export interface MascotDerivationInput {
  isDownloading: boolean;
  isInspecting: boolean;
  hasError: boolean;
  recentSuccess: boolean;
}

export function deriveMascotMood(input: MascotDerivationInput): MascotMood {
  if (input.hasError) {
    return 'error';
  }
  if (input.isDownloading) {
    return 'downloading';
  }
  if (input.isInspecting) {
    return 'inspecting';
  }
  if (input.recentSuccess) {
    return 'success';
  }
  return 'idle';
}

export function toggleMascotVisibility(current: boolean): boolean {
  return !current;
}

export function resolveInitialMascotVisibility(stored: string | null): boolean {
  if (stored === 'false') {
    return false;
  }
  return true;
}

export function saveMascotVisibility(visible: boolean, storage?: Storage | null): void {
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (target && typeof target.setItem === 'function') {
      target.setItem(MASCOT_STORAGE_KEY, String(visible));
    }
  } catch {
    // Gracefully ignore storage quota or sandbox restrictions
  }
}

export function loadSavedMascotVisibility(storage?: Storage | null): boolean {
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (target && typeof target.getItem === 'function') {
      return resolveInitialMascotVisibility(target.getItem(MASCOT_STORAGE_KEY));
    }
  } catch {
    // Gracefully ignore storage failures
  }
  return true;
}
