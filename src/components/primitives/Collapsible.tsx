/**
 * Collapsible Component
 *
 * Expandable/collapsible section with header and content.
 * Useful for organizing large amounts of information.
 */

import { useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';

interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  icon,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-pkt-grays-gray-300 rounded-lg overflow-hidden bg-pkt-bg-card shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-pkt-bg-subtle hover:bg-pkt-grays-gray-100 transition-colors flex items-center justify-between text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-oslo-blue">{icon}</span>}
          <h3 className="text-base font-semibold text-pkt-text-body-dark">{title}</h3>
        </div>
        <ChevronDownIcon
          className={`w-5 h-5 text-pkt-grays-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}
