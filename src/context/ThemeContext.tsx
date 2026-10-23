import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '../services/api';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'brolabs_theme';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
  /** Hidrata a preferência vinda do servidor (vitória do servidor sobre o local). */
  hydrateFromServer: (serverTheme?: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // sem storage
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyClass(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const resolvedTheme: 'light' | 'dark' =
    theme === 'dark' || (theme === 'system' && systemPrefersDark()) ? 'dark' : 'light';

  useEffect(() => {
    applyClass(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // sem storage
    }
  }, [theme]);

  // `system` reativo: acompanha mudança do SO em tempo real
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyClass('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    // sync com servidor (falha silenciosa — local já foi persistido)
    api.updateMyPreferences({ theme: t }).catch(() => {});
  }, []);

  const hydrateFromServer = useCallback((serverTheme?: Theme) => {
    if (!serverTheme) return;
    setThemeState(serverTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, hydrateFromServer }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
