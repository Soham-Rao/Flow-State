import type { BoardBackground } from "@/types/board";

export interface BoardBackgroundPreset {
  id: Exclude<BoardBackground, "sunset-grid">;
  label: string;
  className: string;
  surfaceClassName: string;
}

// Quick tuning knobs for board-page background intensity:
// - Darker: lower the linear-gradient alpha values (currently 0.90)
// - Lighter: raise the linear-gradient alpha values toward 0.95+
export const boardBackgroundPresets: BoardBackgroundPreset[] = [
  {
    id: "teal-gradient",
    label: "Teal Gradient",
    className: "board-bg-teal-gradient",
    surfaceClassName: "board-surface-teal-gradient"
  },
  {
    id: "ocean-glow",
    label: "Ocean Glow",
    className: "board-bg-ocean-glow",
    surfaceClassName: "board-surface-ocean-glow"
  },
  {
    id: "slate-minimal",
    label: "Slate Minimal",
    className: "board-bg-slate-minimal",
    surfaceClassName: "board-surface-slate-minimal"
  },
  {
    id: "ember-horizon",
    label: "Ember Horizon",
    className: "board-bg-ember-horizon",
    surfaceClassName: "board-surface-ember-horizon"
  },
  {
    id: "mint-breeze",
    label: "Mint Breeze",
    className: "board-bg-mint-breeze",
    surfaceClassName: "board-surface-mint-breeze"
  },
  {
    id: "rose-aurora",
    label: "Rose Aurora",
    className: "board-bg-rose-aurora",
    surfaceClassName: "board-surface-rose-aurora"
  },
  {
    id: "cobalt-dawn",
    label: "Cobalt Dawn",
    className: "board-bg-cobalt-dawn",
    surfaceClassName: "board-surface-cobalt-dawn"
  }
]

const legacyBackgroundClasses: Partial<Record<BoardBackground, string>> = {
  "sunset-grid": "board-bg-sunset-grid"
};

const legacySurfaceClasses: Partial<Record<BoardBackground, string>> = {
  "sunset-grid": "board-surface-sunset-grid"
};

export function getBoardBackgroundClass(background: BoardBackground): string {
  return (
    boardBackgroundPresets.find((preset) => preset.id === background)?.className ??
    legacyBackgroundClasses[background] ??
    boardBackgroundPresets[0].className
  );
}

export function getBoardSurfaceClass(background: BoardBackground): string {
  return (
    boardBackgroundPresets.find((preset) => preset.id === background)?.surfaceClassName ??
    legacySurfaceClasses[background] ??
    boardBackgroundPresets[0].surfaceClassName
  );
}
