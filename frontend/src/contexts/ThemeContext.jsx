import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize theme from sessionStorage and apply to document
  useEffect(() => {
    const savedDarkMode = sessionStorage.getItem('theme_dark_mode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const darkMode = savedDarkMode !== null ? savedDarkMode === 'true' : prefersDark;
    setIsDarkMode(darkMode);
    applyTheme(darkMode);
    setIsHydrated(true);
  }, []);

  // Apply theme to document
  const applyTheme = (isDark) => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    sessionStorage.setItem('theme_dark_mode', String(newDarkMode));
    applyTheme(newDarkMode);
  };

  // Set dark mode explicitly
  const setDarkMode = (value) => {
    setIsDarkMode(value);
    sessionStorage.setItem('theme_dark_mode', String(value));
    applyTheme(value);
  };

  const value = {
    isDarkMode,
    toggleDarkMode,
    setDarkMode,
    isHydrated,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
