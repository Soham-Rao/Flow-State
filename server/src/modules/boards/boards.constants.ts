export const boardBackgrounds = [
  "teal-gradient",
  "ocean-glow",
  "slate-minimal",
  "ember-horizon",
  "mint-breeze",
  "rose-aurora",
  "cobalt-dawn",
  "sunset-grid"
] as const;

export type BoardBackground = (typeof boardBackgrounds)[number];
