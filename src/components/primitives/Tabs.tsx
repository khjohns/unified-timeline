/**
 * Tabs Component
 *
 * Simple tabs component for switching between content sections.
 * Optimized for mobile with horizontal scrolling, snap behavior, and fade indicators.
 */

import clsx from 'clsx';

interface Tab {
  id: string;
  label: string;
  /** Short label for mobile displays */
  shortLabel?: string;
  /** Optional icon to display before the label */
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
  /** Show only icons on mobile (requires tabs to have icons) */
  iconOnlyMobile?: boolean;
  /** Make tabs fill the full width equally (good for 2-3 tabs in modals) */
  fullWidth?: boolean;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  iconOnlyMobile = false,
  fullWidth = false,
}: TabsProps) {
  return (
    <div className={clsx('relative', className)}>
      {/* Fade indicator for scrollable content on mobile (hidden when fullWidth) */}
      {!fullWidth && (
        <div
          className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden z-10 dark:from-pkt-bg-canvas"
          aria-hidden="true"
        />
      )}

      <div
        className={clsx(
          'flex border-b border-pkt-border-subtle',
          fullWidth ? '' : 'overflow-x-auto scrollbar-hide snap-x snap-mandatory'
        )}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
              fullWidth ? 'flex-1 justify-center' : 'snap-start',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-pkt-brand-purple-1000/30 focus-visible:ring-inset',
              'flex items-center gap-2',
              activeTab === tab.id
                ? 'text-pkt-text-body-dark border-b-2 border-pkt-text-body-dark -mb-px bg-pkt-surface-subtle'
                : 'text-pkt-text-body-muted hover:text-pkt-text-body-default hover:bg-pkt-surface-light-beige'
            )}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span className={iconOnlyMobile && tab.icon ? 'hidden sm:inline' : ''}>
              {tab.shortLabel && <span className="sm:hidden">{tab.shortLabel}</span>}
              <span className={tab.shortLabel ? 'hidden sm:inline' : ''}>
                {tab.label}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
