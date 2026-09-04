import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '', style = {} }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`tf-navbar-btn ${className}`}
      onClick={toggleTheme}
      style={{ position: 'relative', padding: '0 10px', ...style }}
      title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
      aria-label="Toggle dark/light mode"
    >
      {theme === 'dark' ? (
        <Sun size={15} style={{ color: '#fbbf24' }} />
      ) : (
        <Moon size={15} />
      )}
    </button>
  );
}
