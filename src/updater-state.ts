export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'applying'
  | 'ready'
  | 'error'
  | 'dismissed';

export interface UpdateMetadata {
  version: string;
  notes?: string;
  setupUrl?: string;
  portableUrl?: string;
  isInstalled: boolean;
}

export type UpdaterState =
  | { status: 'idle' }
  | { status: 'checking' }
  | ({ status: 'available' } & UpdateMetadata)
  | ({ status: 'downloading'; progress: number } & UpdateMetadata)
  | ({ status: 'applying' } & UpdateMetadata)
  | ({ status: 'ready' } & UpdateMetadata)
  | { status: 'error'; message: string }
  | { status: 'dismissed'; version: string };

export function createUpdaterState(): UpdaterState {
  return { status: 'idle' };
}

export function isNewerVersion(remoteVersion: string, currentVersion: string): boolean {
  const clean = (v: string) => v.trim().replace(/^v/i, '');
  if (![remoteVersion, currentVersion].every((v) => /^\d+(?:\.\d+)*$/.test(clean(v)))) return false;
  const rParts = clean(remoteVersion).split('.').map(Number);
  const cParts = clean(currentVersion).split('.').map(Number);

  if (rParts.some(isNaN) || cParts.some(isNaN) || rParts.length === 0 || cParts.length === 0) {
    return false;
  }

  const len = Math.max(rParts.length, cParts.length);
  for (let i = 0; i < len; i++) {
    const r = rParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

export interface ConcurrencyContext {
  isDownloading: boolean;
  isInspecting: boolean;
}

export function canStartUpdate(context: ConcurrencyContext): { allowed: boolean; reason: string | null } {
  if (context.isDownloading) {
    return {
      allowed: false,
      reason: 'กำลังดาวน์โหลดไฟล์อยู่ กรุณารอให้เสร็จสิ้นก่อนเริ่มอัปเดตแอป',
    };
  }
  if (context.isInspecting) {
    return {
      allowed: false,
      reason: 'กำลังตรวจสอบข้อมูลลิงก์อยู่ กรุณารอสักครู่ก่อนเริ่มอัปเดตแอป',
    };
  }
  return { allowed: true, reason: null };
}

export const UpdaterAction = {
  check(_state: UpdaterState): UpdaterState {
    return { status: 'checking' };
  },

  available(_state: UpdaterState, meta: UpdateMetadata): UpdaterState {
    return {
      status: 'available',
      ...meta,
    };
  },

  startDownload(state: UpdaterState): UpdaterState {
    if (state.status !== 'available' || !state.isInstalled) {
      return state;
    }
    const meta: UpdateMetadata = {
      version: state.version,
      notes: state.notes,
      setupUrl: state.setupUrl,
      portableUrl: state.portableUrl,
      isInstalled: state.isInstalled,
    };
    return {
      status: 'downloading',
      progress: 0,
      ...meta,
    };
  },

  progress(state: UpdaterState, progress: number): UpdaterState {
    if (state.status !== 'downloading') {
      return state;
    }
    return {
      ...state,
      progress: Math.min(100, Math.max(0, progress)),
    };
  },

  ready(state: UpdaterState): UpdaterState {
    if (state.status !== 'downloading') {
      return state;
    }
    return {
      status: 'ready',
      version: state.version,
      notes: state.notes,
      setupUrl: state.setupUrl,
      portableUrl: state.portableUrl,
      isInstalled: state.isInstalled,
    };
  },

  apply(state: UpdaterState): UpdaterState {
    return state.status === 'ready' && state.isInstalled ? { ...state, status: 'applying' } : state;
  },

  error(_state: UpdaterState, message: string): UpdaterState {
    return {
      status: 'error',
      message,
    };
  },

  dismiss(state: UpdaterState): UpdaterState {
    const version = 'version' in state ? state.version : '';
    return {
      status: 'dismissed',
      version,
    };
  },
};
