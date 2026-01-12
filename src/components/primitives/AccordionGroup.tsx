/**
 * AccordionGroup Component
 *
 * Multi-item accordion list with Timeline-inspired styling.
 * Built on Radix Accordion for full accessibility support.
 *
 * Supports both single-expand and multi-expand modes.
 */

import * as RadixAccordion from '@radix-ui/react-accordion';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';

interface AccordionGroupItem {
  /** Unique identifier for the item */
  id: string;
  /** Title displayed in the header */
  title: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Optional icon displayed before title */
  icon?: React.ReactNode;
  /** Optional badge/tag displayed after title */
  badge?: React.ReactNode;
  /** Content shown when expanded */
  content: React.ReactNode;
}

interface AccordionGroupSingleProps {
  /** List of accordion items */
  items: AccordionGroupItem[];
  /** Only one item can be open at a time */
  multiple?: false;
  /** Default expanded item id */
  defaultValue?: string;
  /** Controlled value (id of open item) */
  value?: string;
  /** Callback when value changes */
  onValueChange?: (value: string) => void;
  /** Visual variant: 'default' or 'subtle' (with background) */
  variant?: 'default' | 'subtle';
  /** Size variant affecting padding: 'sm' or 'md' */
  size?: 'sm' | 'md';
  /** Additional className for the container */
  className?: string;
}

interface AccordionGroupMultipleProps {
  /** List of accordion items */
  items: AccordionGroupItem[];
  /** Multiple items can be open simultaneously */
  multiple: true;
  /** Default expanded item ids */
  defaultValue?: string[];
  /** Controlled value (ids of open items) */
  value?: string[];
  /** Callback when value changes */
  onValueChange?: (value: string[]) => void;
  /** Visual variant: 'default' or 'subtle' (with background) */
  variant?: 'default' | 'subtle';
  /** Size variant affecting padding: 'sm' or 'md' */
  size?: 'sm' | 'md';
  /** Additional className for the container */
  className?: string;
}

type AccordionGroupProps = AccordionGroupSingleProps | AccordionGroupMultipleProps;

export function AccordionGroup({
  items,
  multiple = false,
  defaultValue,
  value,
  onValueChange,
  variant = 'default',
  size = 'md',
  className,
}: AccordionGroupProps) {
  const triggerClasses = clsx(
    'w-full flex items-center gap-3 text-left',
    'transition-colors cursor-pointer group',
    'hover:bg-pkt-bg-subtle',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pkt-brand-purple-1000/30',
    size === 'sm' ? 'py-2 px-2' : 'py-3 px-3',
    'border-b border-pkt-border-subtle'
  );

  const contentClasses = clsx(
    'bg-pkt-bg-subtle border-b border-pkt-grays-gray-100',
    size === 'sm' ? 'px-2 py-2' : 'px-3 py-3'
  );

  // Render items
  const renderItems = () =>
    items.map((item) => (
      <RadixAccordion.Item key={item.id} value={item.id}>
        <RadixAccordion.Header className="m-0">
          <RadixAccordion.Trigger className={triggerClasses}>
            {item.icon && (
              <span className="text-oslo-blue shrink-0">{item.icon}</span>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-pkt-text-body-dark truncate">
                  {item.title}
                </span>
                {item.badge}
              </div>
              {item.subtitle && (
                <span className="text-xs text-pkt-text-body-subtle">
                  {item.subtitle}
                </span>
              )}
            </div>

            <ChevronDownIcon
              className={clsx(
                'w-4 h-4 text-pkt-text-body-muted shrink-0',
                'transition-transform duration-200',
                'group-data-[state=open]:rotate-180'
              )}
            />
          </RadixAccordion.Trigger>
        </RadixAccordion.Header>

        <RadixAccordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
          <div className={contentClasses}>{item.content}</div>
        </RadixAccordion.Content>
      </RadixAccordion.Item>
    ));

  // Render based on mode
  if (multiple) {
    return (
      <RadixAccordion.Root
        type="multiple"
        defaultValue={defaultValue as string[] | undefined}
        value={value as string[] | undefined}
        onValueChange={onValueChange as ((value: string[]) => void) | undefined}
        className={clsx(
          'space-y-0',
          variant === 'subtle' && 'bg-pkt-bg-subtle',
          className
        )}
      >
        {renderItems()}
      </RadixAccordion.Root>
    );
  }

  return (
    <RadixAccordion.Root
      type="single"
      collapsible
      defaultValue={defaultValue as string | undefined}
      value={value as string | undefined}
      onValueChange={onValueChange as ((value: string) => void) | undefined}
      className={clsx(
        'space-y-0',
        variant === 'subtle' && 'bg-pkt-bg-subtle',
        className
      )}
    >
      {renderItems()}
    </RadixAccordion.Root>
  );
}
