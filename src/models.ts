export interface QualityOption {
  id: string;
  label: string;
  ext: string;
  format_spec: string;
  filesize_approx?: number | null;
}

export interface PhotoImage {
  index: number;
  preview_url: string;
  download_url: string;
  width?: number | null;
  height?: number | null;
}

export interface VideoDetails {
  type: "video";
  id: string;
  title: string;
  thumbnail: string;
  duration?: number | null;
  channel?: string | null;
  filesize_approx?: number | null;
  qualities: QualityOption[];
}

export interface PhotoAlbumDetails {
  type: "photo_album";
  id: string;
  title: string;
  cover_url: string;
  channel?: string | null;
  images: PhotoImage[];
}

/** Discriminated union of media inspection results. */
export type MediaDetails = VideoDetails | PhotoAlbumDetails;

export interface VideoDownloadOutcome {
  kind: "video";
  file_path: string;
  file_name: string;
}

export interface PhotoAlbumDownloadOutcome {
  kind: "photo_album";
  total: number;
  succeeded: number;
  failed_indices: number[];
  saved_files: string[];
  folder_path: string;
  primary_file_path?: string | null;
}

/** Verified synchronous download result across the IPC boundary. */
export type DownloadOutcome = VideoDownloadOutcome | PhotoAlbumDownloadOutcome;

export interface PhotoDownloadResult {
  total: number;
  succeeded: number;
  failed_indices: number[];
  saved_files: string[];
}

export interface DownloadProgressPayload {
  progress: number;
  speed: string;
  eta: string;
  status: string;
  message: string;
  filename?: string;
}

export interface DependencyStatus {
  ytdlp_available: boolean;
  ffmpeg_available: boolean;
  ffprobe_available: boolean;
  ytdlp_path: string | null;
  ffmpeg_path: string | null;
  ffprobe_path: string | null;
  ytdlp_version: string | null;
  app_bin_dir: string;
}

export interface AppError {
  summary: string;
  detail?: string;
}

export type Status = "idle" | "checking" | "ready" | "downloading" | "completed";
