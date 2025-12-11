/**
 * ThemeToggle Component
 *
 * A toggle button group for switching between light, dark, and system themes.
 * Uses the ThemeContext to manage theme state.
 */

import { useTheme } from '../context/ThemeContext';
import { SunIcon, MoonIcon, DesktopIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light', icon: SunIcon, label: 'Lyst tema' },
    { value: 'dark', icon: MoonIcon, label: 'Mørkt tema' },
    { value: 'system', icon: DesktopIcon, label: 'Systemvalg' },
  ] as const;

  return (
    <div className="flex items-center gap-1 p-1 bg-pkt-bg-subtle rounded-lg border border-pkt-grays-gray-200">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={clsx(
            'p-2 rounded-md transition-colors',
            theme === value
              ? 'bg-pkt-bg-card text-pkt-text-body-dark shadow-sm'
              : 'text-pkt-grays-gray-500 hover:text-pkt-text-body-dark hover:bg-pkt-bg-card/50'
          )}
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
