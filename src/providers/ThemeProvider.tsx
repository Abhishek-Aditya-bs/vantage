/**
 * Theme provider — toggles a `.dark` class on <html>.
 *
 * `mode` is the user's intent: 'light' | 'dark' | 'system'. When 'system', the
 * resolved `theme` follows `prefers-color-scheme` and live-updates. The intent
 * is persisted in localStorage ('vantage-theme'); a missing/invalid value means
 * 'system'. `toggle()` flips between the two concrete themes.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";
type Mode = Theme | "system";
const STORAGE_KEY = "vantage-theme";

interface ThemeContextValue {
  /** the actually-applied theme */
  theme: Theme;
  /** the user's chosen intent */
  mode: Mode;
  toggle: () => void;
  setMode: (m: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function storedMode(): Mode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    /* ignore */
  }
  // Vantage is a dark-primary product; default to dark on first visit.
  return "dark";
}

function persist(mode: Mode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => storedMode());
  const [system, setSystem] = useState<Theme>(() => systemTheme());

  const theme: Theme = mode === "system" ? system : mode;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Track OS changes (only meaningful while mode === 'system').
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    persist(m);
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const current: Theme = prev === "system" ? systemTheme() : prev;
      const next: Theme = current === "dark" ? "light" : "dark";
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, toggle, setMode }),
    [theme, mode, toggle, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
