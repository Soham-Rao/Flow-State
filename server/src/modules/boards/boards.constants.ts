export const boardBackgrounds = [
  "teal-gradient",
  "sunset-grid",
  "ocean-glow",
  "slate-minimal",
  "ember-horizon"
] as const;

export type BoardBackground = (typeof boardBackgrounds)[number];
