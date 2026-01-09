/**
 * InlineDataList Component
 *
 * A compact inline display for key-value pairs, separated by "|".
 * Best suited for displaying a few comparable values (e.g., "Krevd: 14 | Godkjent: 7").
 *
 * Use DataList with variant="grid" for more detailed information with label above value.
 */

import { ReactNode, Children, isValidElement } from 'react';

type InlineDataListVariant = 'default' | 'danger' | 'warning' | 'success';

interface InlineDataListProps {
  children: ReactNode;
  className?: string;
  /** Show bottom border (default: false) */
  bordered?: boolean;
}

interface InlineDataListItemProps {
  /** Label displayed before the value */
  label: string;
  /** The value to display */
  children: ReactNode;
  /** Visual variant for the item */
  variant?: InlineDataListVariant;
  /** Use monospace font for the value (good for numbers) */
  mono?: boolean;
  /** Make the value bold */
  bold?: boolean;
}

const variantStyles: Record<InlineDataListVariant, string> = {
  default: '',
  danger: 'text-alert-danger-text',
  warning: 'text-alert-warning-text',
  success: 'text-alert-success-text',
};

/**
 * Container for inline data items
 */
export function InlineDataList({ children, className = '', bordered = false }: InlineDataListProps) {
  const items = Children.toArray(children).filter(isValidElement);

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${
        bordered ? 'pb-2 border-b border-pkt-border-subtle' : ''
      } ${className}`}
    >
      {items.map((child, index) => (
        <span key={index} className="contents">
          {child}
          {index < items.length - 1 && (
            <span className="text-pkt-border-subtle">|</span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Individual item in the inline data list
 */
export function InlineDataListItem({
  label,
  children,
  variant = 'default',
  mono = false,
  bold = false,
}: InlineDataListItemProps) {
  const variantClass = variantStyles[variant];
  const valueClasses = [
    variantClass,
    mono ? 'font-mono' : '',
    bold ? 'font-bold' : 'font-medium',
  ].filter(Boolean).join(' ');

  return (
    <span className={variantClass}>
      <span className={variant === 'default' ? 'text-pkt-text-body-subtle' : ''}>
        {label}:
      </span>{' '}
      <span className={valueClasses}>{children}</span>
    </span>
  );
}
