import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const THEME_KEY = 'chores-theme';
const THEMES = ['light', 'dusk', 'midnight'];

const ThemeContext = createContext(null);

function getSystemPreference() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dusk' : 'light';
}

function getSavedTheme() {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(THEME_KEY);
  if (saved && THEMES.includes(saved)) return saved;
  return null;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return getSavedTheme() || getSystemPreference();
  });

  const applyTheme = useCallback((themeName) => {
    const root = document.documentElement;
    if (themeName === 'light') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', themeName);
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      const saved = getSavedTheme();
      if (!saved) {
        const newTheme = e.matches ? 'dusk' : 'light';
        setThemeState(newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (!THEMES.includes(newTheme)) return;
    localStorage.setItem(THEME_KEY, newTheme);
    setThemeState(newTheme);
  }, []);

  const value = {
    theme,
    setTheme,
    themes: THEMES,
    isDark: theme !== 'light'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
