export interface QualityOption {
  id: string;
  label: string;
  ext: string;
  format_spec: string;
  filesize_approx?: number | null;
}

export interface VideoMetadata {
  id: string;
  title: string;
  thumbnail: string;
  duration?: number;
  channel?: string;
  filesize_approx?: number | null;
  qualities: QualityOption[];
}

export interface AppError { summary: string; detail?: string }
export type Status = "idle" | "checking" | "ready" | "downloading" | "completed";
export const initialVideoInput = {
  url: "", meta: null as VideoMetadata | null, selectedQualityId: "",
  status: "idle" as Status, error: null as AppError | null, revision: 0,
};

type Action =
  | { type: "change"; url: string }
  | { type: "inspect"; url: string; revision: number }
  | { type: "success"; revision: number; meta: VideoMetadata }
  | { type: "failure"; revision: number; error: AppError }
  | { type: "patch"; patch: Partial<Pick<typeof initialVideoInput, "status" | "error" | "selectedQualityId">> };

export function videoInputReducer(state: typeof initialVideoInput, action: Action): typeof initialVideoInput {
  switch (action.type) {
    case "change":
      return { ...initialVideoInput, url: action.url, revision: state.revision + 1 };
    case "inspect":
      return { ...initialVideoInput, url: action.url, status: "checking", revision: action.revision };
    case "success":
      if (action.revision !== state.revision || state.status !== "checking") return state;
      return { ...state, meta: action.meta, selectedQualityId: action.meta.qualities[0]?.id ?? "", status: "ready" };
    case "failure":
      if (action.revision !== state.revision || state.status !== "checking") return state;
      return { ...state, status: "idle", error: action.error };
    case "patch":
      return { ...state, ...action.patch };
  }
}
