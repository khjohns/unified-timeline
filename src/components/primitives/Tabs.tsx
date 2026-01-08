/**
 * Tabs Component
 *
 * Simple tabs component for switching between content sections.
 */

import clsx from 'clsx';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={clsx('flex border-b border-pkt-border-subtle', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={clsx(
            'px-4 py-2 text-sm font-medium transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-pkt-brand-purple-1000/30',
            activeTab === tab.id
              ? 'text-pkt-text-body-dark border-b-2 border-pkt-text-body-dark -mb-px'
              : 'text-pkt-text-body-muted hover:text-pkt-text-body-default'
          )}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
