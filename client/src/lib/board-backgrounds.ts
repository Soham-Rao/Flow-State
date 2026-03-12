import type { BoardBackground } from "@/types/board";

interface BoardBackgroundPreset {
  id: BoardBackground;
  label: string;
  className: string;
}

export const boardBackgroundPresets: BoardBackgroundPreset[] = [
  {
    id: "teal-gradient",
    label: "Teal Gradient",
    className: "bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600"
  },
  {
    id: "sunset-grid",
    label: "Sunset Grid",
    className: "bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.25)_1px,transparent_0)] [background-size:22px_22px] bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
  },
  {
    id: "ocean-glow",
    label: "Ocean Glow",
    className: "bg-gradient-to-br from-teal-400 via-cyan-500 to-indigo-600"
  },
  {
    id: "slate-minimal",
    label: "Slate Minimal",
    className: "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-800"
  },
  {
    id: "ember-horizon",
    label: "Ember Horizon",
    className: "bg-gradient-to-br from-red-500 via-orange-500 to-amber-400"
  }
];

export function getBoardBackgroundClass(background: BoardBackground): string {
  return (
    boardBackgroundPresets.find((preset) => preset.id === background)?.className ??
    boardBackgroundPresets[0].className
  );
}
