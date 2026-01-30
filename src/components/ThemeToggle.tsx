/**
 * ThemeToggle Component
 *
 * A simple toggle button for switching between light and dark themes.
 * Shows sun icon in dark mode, moon icon in light mode.
 * Defaults to system preference on first load.
 */

import { useTheme } from '../context/ThemeContext';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg bg-pkt-bg-subtle border border-pkt-grays-gray-200
                 hover:bg-pkt-bg-card hover:border-pkt-border-default
                 focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/30
                 transition-all duration-200"
      aria-label={resolvedTheme === 'dark' ? 'Bytt til lys modus' : 'Bytt til mørk modus'}
    >
      {resolvedTheme === 'dark' ? (
        <SunIcon className="w-4 h-4 text-pkt-brand-yellow-1000" />
      ) : (
        <MoonIcon className="w-4 h-4 text-pkt-brand-dark-blue-1000" />
      )}
    </button>
  );
}
