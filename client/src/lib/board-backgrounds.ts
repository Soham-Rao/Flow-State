import type { BoardBackground } from "@/types/board";

interface BoardBackgroundPreset {
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
    className: "bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600",
    surfaceClassName:
      "bg-[radial-gradient(circle_at_8%_8%,rgba(6,182,212,0.29),transparent_38%),radial-gradient(circle_at_92%_16%,rgba(59,130,246,0.24),transparent_40%),linear-gradient(180deg,rgba(236,254,255,0.90),rgba(239,246,255,0.90))]"
  },
  {
    id: "ocean-glow",
    label: "Ocean Glow",
    className: "bg-gradient-to-br from-teal-400 via-cyan-500 to-indigo-600",
    surfaceClassName:
      "bg-[radial-gradient(circle_at_12%_12%,rgba(20,184,166,0.28),transparent_40%),radial-gradient(circle_at_88%_18%,rgba(99,102,241,0.24),transparent_38%),linear-gradient(180deg,rgba(236,253,245,0.90),rgba(238,242,255,0.90))]"
  },
  {
    id: "slate-minimal",
    label: "Slate Minimal",
    className: "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-800",
    surfaceClassName:
      "bg-[radial-gradient(circle_at_10%_10%,rgba(71,85,105,0.26),transparent_40%),radial-gradient(circle_at_86%_20%,rgba(30,41,59,0.22),transparent_38%),linear-gradient(180deg,rgba(248,250,252,0.90),rgba(241,245,249,0.90))]"
  },
  {
    id: "ember-horizon",
    label: "Ember Horizon",
    className: "bg-gradient-to-br from-red-500 via-orange-500 to-amber-400",
    surfaceClassName:
      "bg-[radial-gradient(circle_at_14%_12%,rgba(239,68,68,0.24),transparent_36%),radial-gradient(circle_at_86%_18%,rgba(251,146,60,0.26),transparent_40%),linear-gradient(180deg,rgba(255,247,237,0.90),rgba(255,251,235,0.90))]"
  },
  {
    id: "mint-breeze",
    label: "Mint Breeze",
    className: "bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500",
    surfaceClassName:
      "bg-[radial-gradient(circle_at_12%_10%,rgba(16,185,129,0.28),transparent_40%),radial-gradient(circle_at_90%_20%,rgba(6,182,212,0.24),transparent_38%),linear-gradient(180deg,rgba(236,253,245,0.90),rgba(236,254,255,0.90))]"
  },
  {
    id: "rose-aurora",
    label: "Rose Aurora",
    className: "bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-500",
    surfaceClassName:
      "bg-[radial-gradient(circle_at_10%_10%,rgba(244,63,94,0.26),transparent_40%),radial-gradient(circle_at_88%_18%,rgba(217,70,239,0.22),transparent_38%),linear-gradient(180deg,rgba(255,241,242,0.90),rgba(253,242,248,0.90))]"
  },
  {
    id: "cobalt-dawn",
    label: "Cobalt Dawn",
    className: "bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500",
    surfaceClassName:
      "bg-[radial-gradient(circle_at_14%_12%,rgba(59,130,246,0.28),transparent_40%),radial-gradient(circle_at_86%_18%,rgba(139,92,246,0.20),transparent_38%),linear-gradient(180deg,rgba(239,246,255,0.90),rgba(243,244,255,0.90))]"
  }
];

const legacyBackgroundClasses: Partial<Record<BoardBackground, string>> = {
  "sunset-grid": "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
};

const legacySurfaceClasses: Partial<Record<BoardBackground, string>> = {
  "sunset-grid":
    "bg-[radial-gradient(circle_at_10%_10%,rgba(251,146,60,0.24),transparent_36%),radial-gradient(circle_at_86%_20%,rgba(244,63,94,0.20),transparent_40%),linear-gradient(180deg,rgba(255,247,237,0.90),rgba(255,241,242,0.90))]"
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
