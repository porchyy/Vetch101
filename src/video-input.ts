import type {
  MediaDetails,
  VideoDetails,
  PhotoAlbumDetails,
  QualityOption,
  PhotoImage,
  AppError,
  Status,
} from "./models.ts";
import { sessionReducer } from "./useDownloadSession.ts";

export type {
  MediaDetails,
  VideoDetails,
  PhotoAlbumDetails,
  QualityOption,
  PhotoImage,
  AppError,
  Status,
};

export const initialVideoInput = {
  url: "",
  meta: null as MediaDetails | null,
  selectedQualityId: "",
  status: "idle" as Status,
  error: null as AppError | null,
  revision: 0,
};

type Action =
  | { type: "change"; url: string }
  | { type: "inspect"; url: string; revision: number }
  | { type: "success"; revision: number; meta: MediaDetails }
  | { type: "failure"; revision: number; error: AppError }
  | {
      type: "patch";
      patch: Partial<
        Pick<typeof initialVideoInput, "status" | "error" | "selectedQualityId">
      >;
    };

export function videoInputReducer(
  state: typeof initialVideoInput,
  action: Action,
): typeof initialVideoInput {
  switch (action.type) {
    case "change": {
      const res = sessionReducer(state as any, { type: "change_url", url: action.url });
      return {
        url: res.url,
        meta: res.meta,
        selectedQualityId: res.selectedQualityId,
        status: res.status,
        error: res.error,
        revision: res.revision,
      };
    }
    case "inspect": {
      const res = sessionReducer(state as any, {
        type: "start_inspect",
        url: action.url,
        revision: action.revision,
      });
      return {
        url: res.url,
        meta: res.meta,
        selectedQualityId: res.selectedQualityId,
        status: res.status,
        error: res.error,
        revision: res.revision,
      };
    }
    case "success": {
      const res = sessionReducer(state as any, {
        type: "inspect_success",
        revision: action.revision,
        meta: action.meta,
      });
      if (res === (state as any)) return state;
      return {
        url: res.url,
        meta: res.meta,
        selectedQualityId: res.selectedQualityId,
        status: res.status,
        error: res.error,
        revision: res.revision,
      };
    }
    case "failure": {
      const res = sessionReducer(state as any, {
        type: "inspect_failure",
        revision: action.revision,
        error: action.error,
      });
      if (res === (state as any)) return state;
      return {
        url: res.url,
        meta: res.meta,
        selectedQualityId: res.selectedQualityId,
        status: res.status,
        error: res.error,
        revision: res.revision,
      };
    }
    case "patch":
      return { ...state, ...action.patch };
  }
}
