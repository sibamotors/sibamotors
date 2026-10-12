import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ACCENT_IDS, FONT_IDS, THEME_IDS, THEME_SCHEME } from "@/lib/constants";
import type { AccentId, ColorScheme, FontId, ThemeId } from "@/lib/types";

type ThemeCtx = {
  theme: ThemeId;
  accent: AccentId;
  font: FontId;
  scheme: ColorScheme;
  setTheme: (t: ThemeId) => void;
  setAccent: (a: AccentId) => void;
  setFont: (f: FontId) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

const THEME_KEY = "sibamotor-theme";
const ACCENT_KEY = "sibamotor-accent";
const FONT_KEY = "sibamotor-font";

function isTheme(v: string | null): v is ThemeId {
  return Boolean(v && THEME_IDS.includes(v as ThemeId));
}
function isAccent(v: string | null): v is AccentId {
  return Boolean(v && ACCENT_IDS.includes(v as AccentId));
}
function isFont(v: string | null): v is FontId {
  return Boolean(v && FONT_IDS.includes(v as FontId));
}

function apply(theme: ThemeId, accent: AccentId, font: FontId) {
  const el = document.documentElement;
  const scheme = THEME_SCHEME[theme];
  el.dataset.theme = theme;
  el.dataset.accent = accent;
  el.dataset.font = font;
  el.dataset.scheme = scheme;
  el.style.colorScheme = scheme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(el).getPropertyValue("--k-bg").trim() || (scheme === "dark" ? "#111111" : "#f6f6f4");
    meta.setAttribute("content", bg);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("ink");
  const [accent, setAccentState] = useState<AccentId>("blue");
  const [font, setFontState] = useState<FontId>("vazirmatn");

  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      const a = localStorage.getItem(ACCENT_KEY);
      const f = localStorage.getItem(FONT_KEY);
      const theme0: ThemeId = isTheme(t) ? t : "ink";
      const accent0: AccentId = isAccent(a) ? a : "blue";
      const font0: FontId = isFont(f) ? f : "vazirmatn";
      setThemeState(theme0);
      setAccentState(accent0);
      setFontState(font0);
      apply(theme0, accent0, font0);
    } catch {
      apply("ink", "blue", "vazirmatn");
    }
  }, []);

  const persist = useCallback((nextTheme: ThemeId, nextAccent: AccentId, nextFont: FontId) => {
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
      localStorage.setItem(ACCENT_KEY, nextAccent);
      localStorage.setItem(FONT_KEY, nextFont);
    } catch {
      /* ignore */
    }
    apply(nextTheme, nextAccent, nextFont);
  }, []);

  const setTheme = useCallback(
    (t: ThemeId) => {
      setThemeState(t);
      persist(t, accent, font);
    },
    [accent, font, persist],
  );
  const setAccent = useCallback(
    (a: AccentId) => {
      setAccentState(a);
      persist(theme, a, font);
    },
    [theme, font, persist],
  );
  const setFont = useCallback(
    (f: FontId) => {
      setFontState(f);
      persist(theme, accent, f);
    },
    [theme, accent, persist],
  );

  const scheme = THEME_SCHEME[theme];
  const value = useMemo(
    () => ({ theme, accent, font, scheme, setTheme, setAccent, setFont }),
    [theme, accent, font, scheme, setTheme, setAccent, setFont],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
