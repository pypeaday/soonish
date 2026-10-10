import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { THEMES, type Theme, type ThemeName } from '../lib/themes';

export type { Theme, ThemeName } from '../lib/themes';
export { THEMES } from '../lib/themes';

export interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider moved to avoid fast refresh issues

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const stored = localStorage.getItem('eisenhower_theme') as ThemeName;
    return THEMES[stored] ? stored : 'default';
  });

  const theme = THEMES[themeName];

  useEffect(() => {
    localStorage.setItem('eisenhower_theme', themeName);
    
    // Update CSS variables
    const root = document.documentElement;
    const colors = theme.colors;
    
    (Object.entries(colors) as Array<[string, string]>).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Update theme class for Tailwind
    root.classList.remove('dark', 'light');
    root.classList.add('dark');
  }, [theme, themeName]);

  const setTheme = (name: ThemeName) => {
    if (THEMES[name]) {
      setThemeName(name);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme }}>
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