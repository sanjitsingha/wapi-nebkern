"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_MODE, DEFAULT_THEME, type Mode, type ThemeId } from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
  mode: Mode;
  setMode: (next: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const FIXED: ThemeContextValue = {
  theme: DEFAULT_THEME,
  setTheme: () => {},
  mode: DEFAULT_MODE,
  setMode: () => {},
  toggleMode: () => {},
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={FIXED}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FIXED;
}
