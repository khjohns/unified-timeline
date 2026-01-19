/**
 * Collapsible Component
 *
 * Expandable/collapsible section with header and content.
 * Useful for organizing large amounts of information.
 *
 * Built on Radix Collapsible for smooth animations and accessibility.
 */

import * as RadixCollapsible from '@radix-ui/react-collapsible';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useState } from 'react';

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
    <RadixCollapsible.Root
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-pkt-border-subtle rounded overflow-hidden bg-pkt-bg-card shadow-sm"
    >
      <RadixCollapsible.Trigger
        className="w-full px-4 py-3 bg-pkt-bg-subtle hover:bg-pkt-surface-subtle transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-oslo-blue">{icon}</span>}
          <h3 className="text-base font-semibold text-pkt-text-body-dark">{title}</h3>
        </div>
        <ChevronDownIcon
          className={`w-5 h-5 text-pkt-text-body-subtle transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </RadixCollapsible.Trigger>
      <RadixCollapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="p-4">{children}</div>
      </RadixCollapsible.Content>
    </RadixCollapsible.Root>
  );
}
