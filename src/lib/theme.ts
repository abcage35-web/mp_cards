import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "media-plan-theme";
const LEGACY_AB_STORAGE_KEY = "ab-dashboard-theme";

function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (storedValue === "light" || storedValue === "dark" || storedValue === "system") {
      return storedValue;
    }
  } catch {}

  return "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(themePreference: ThemePreference): ResolvedTheme {
  return themePreference === "system" ? getSystemTheme() : themePreference;
}

function persistTheme(themePreference: ThemePreference, resolvedTheme: ResolvedTheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, themePreference);
    window.localStorage.setItem(LEGACY_AB_STORAGE_KEY, resolvedTheme);
  } catch {}
}

function applyTheme(themePreference: ThemePreference) {
  const resolvedTheme = resolveTheme(themePreference);
  const root = document.documentElement;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;
  root.dataset.theme = resolvedTheme;

  persistTheme(themePreference, resolvedTheme);

  return resolvedTheme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredThemePreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getStoredThemePreference()));

  useEffect(() => {
    setResolvedTheme(applyTheme(theme));
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setResolvedTheme(applyTheme("system"));
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
  }, []);

  return {
    theme,
    resolvedTheme,
    setTheme,
  };
}
