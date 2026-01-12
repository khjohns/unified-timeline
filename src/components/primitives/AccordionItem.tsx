/**
 * AccordionItem Component
 *
 * Minimalistic expandable section with Timeline-inspired styling.
 * Features subtle hover effects, minimal borders, and compact layout.
 *
 * For a heavier card-like appearance, use Collapsible instead.
 */

import { useState, useCallback } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';

interface AccordionItemProps {
  /** Title displayed in the header */
  title: string;
  /** Content shown when expanded */
  children: React.ReactNode;
  /** Initial expanded state */
  defaultOpen?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Optional icon displayed before title */
  icon?: React.ReactNode;
  /** Optional badge/tag displayed after title */
  badge?: React.ReactNode;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Visual variant: 'default' or 'subtle' (with background) */
  variant?: 'default' | 'subtle';
  /** Size variant affecting padding: 'sm' or 'md' */
  size?: 'sm' | 'md';
  /** Whether to show border at bottom */
  bordered?: boolean;
  /** Additional className for the container */
  className?: string;
}

export function AccordionItem({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  icon,
  badge,
  subtitle,
  variant = 'default',
  size = 'md',
  bordered = true,
  className,
}: AccordionItemProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleToggle = useCallback(() => {
    const newValue = !isOpen;
    if (!isControlled) {
      setInternalOpen(newValue);
    }
    onOpenChange?.(newValue);
  }, [isControlled, isOpen, onOpenChange]);

  return (
    <div
      className={clsx(variant === 'subtle' && 'bg-pkt-bg-subtle', className)}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={clsx(
          'w-full flex items-center gap-3 text-left',
          'transition-colors cursor-pointer',
          'hover:bg-pkt-bg-subtle',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pkt-brand-purple-1000/30',
          size === 'sm' ? 'py-2 px-2' : 'py-3 px-3',
          bordered && 'border-b border-pkt-border-subtle'
        )}
        aria-expanded={isOpen}
      >
        {icon && <span className="text-oslo-blue shrink-0">{icon}</span>}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-pkt-text-body-dark truncate">
              {title}
            </span>
            {badge}
          </div>
          {subtitle && (
            <span className="text-xs text-pkt-text-body-subtle">{subtitle}</span>
          )}
        </div>

        <ChevronDownIcon
          className={clsx(
            'w-4 h-4 text-pkt-text-body-muted transition-transform shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          className={clsx(
            'bg-pkt-bg-subtle',
            bordered && 'border-b border-pkt-border-subtle',
            size === 'sm' ? 'px-2 py-2' : 'px-3 py-3'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
