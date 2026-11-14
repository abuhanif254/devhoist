'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const applyTheme = (t: Theme) => {
  const root = document.documentElement;
  if (t === 'dark') {
    root.classList.remove('light');
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default theme is strictly 'light'
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Remove any stale legacy 'dark' preference from earlier sessions
    localStorage.removeItem('devhost-theme');
    localStorage.removeItem('devhost-theme-v2');
    localStorage.removeItem('devhost-theme-v3');

    const savedTheme = localStorage.getItem('devhost-theme-v4') as Theme | null;
    const resolvedTheme: Theme = savedTheme === 'dark' ? 'dark' : 'light';
    applyTheme(resolvedTheme);
    const timer = window.setTimeout(() => {
      setTheme(resolvedTheme);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('devhost-theme-v4', newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    handleSetTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, toggleTheme }}>
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
