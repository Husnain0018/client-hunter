import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'client-hunter-theme';

type ThemeListener = (theme: ThemeMode) => void;
const listeners = new Set<ThemeListener>();

export function getSavedTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return 'light';
}

export function applyThemeToDom(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  if (document.body) {
    document.body.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark-mode', theme === 'dark');
    document.body.classList.toggle('light-mode', theme === 'light');
  }
}

export function setThemeMode(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
  applyThemeToDom(theme);
  for (const listener of listeners) {
    try {
      listener(theme);
    } catch (err) {
      console.error('Theme listener error:', err);
    }
  }
}

export function toggleThemeMode(): ThemeMode {
  const next: ThemeMode = getSavedTheme() === 'dark' ? 'light' : 'dark';
  setThemeMode(next);
  return next;
}

export function onThemeChange(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme(): {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<ThemeMode>(() => getSavedTheme());

  useEffect(() => {
    applyThemeToDom(theme);
    return onThemeChange((newTheme) => {
      setThemeState(newTheme);
    });
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme: setThemeMode,
    toggleTheme: () => {
      toggleThemeMode();
    },
  };
}
