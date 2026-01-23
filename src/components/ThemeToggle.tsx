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

  const activeIndex = options.findIndex((opt) => opt.value === theme);

  return (
    <div className="relative isolate flex items-center gap-1 p-1 bg-pkt-bg-subtle rounded-lg border border-pkt-grays-gray-200">
      {/* Animated pill background */}
      <div
        className="absolute top-1 bottom-1 rounded-md bg-pkt-bg-card shadow-sm transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.5rem - 0.5rem) / ${options.length})`,
          transform: `translateX(calc(${activeIndex} * (100% + 0.25rem)))`,
        }}
        aria-hidden="true"
      />
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={clsx(
            'relative z-10 p-2 rounded-md transition-colors duration-200',
            theme === value
              ? 'text-pkt-text-body-dark'
              : 'text-pkt-grays-gray-500 hover:text-pkt-text-body-dark'
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
