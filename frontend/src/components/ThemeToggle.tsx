import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../utils/theme';

interface ThemeToggleProps {
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      data-testid="theme-toggle"
      data-current-theme={theme}
    >
      {isDark ? (
        <>
          <Sun size={15} className="theme-icon sun" />
          {!compact && <span>Light Mode</span>}
        </>
      ) : (
        <>
          <Moon size={15} className="theme-icon moon" />
          {!compact && <span>Dark Mode</span>}
        </>
      )}
    </button>
  );
};
