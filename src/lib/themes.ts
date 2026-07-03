export const DEFAULT_THEME = "teal" as const;
export type ThemeId = "teal";

export const DEFAULT_MODE = "light" as const;
export type Mode = "light";

export const STORAGE_KEY = "wacrm.theme";
export const MODE_STORAGE_KEY = "wacrm.mode";

export const THEME_IDS = ["teal"] as const;
export const MODES = ["light"] as const;

export function isThemeId(value: unknown): value is ThemeId {
  return value === "teal";
}

export function isMode(value: unknown): value is Mode {
  return value === "light";
}
