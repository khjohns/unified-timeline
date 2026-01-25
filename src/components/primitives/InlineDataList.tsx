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
  /** Optional title/header for the list */
  title?: string;
  /** Show bottom border (default: false) */
  bordered?: boolean;
  /** Stack items vertically on mobile (default: false) */
  stackOnMobile?: boolean;
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
  danger: 'text-pkt-brand-red-1000',
  warning: 'text-pkt-brand-yellow-1000',
  success: 'text-pkt-brand-dark-green-1000',
};

/**
 * Container for inline data items
 */
export function InlineDataList({ children, className = '', title, bordered = false, stackOnMobile = false }: InlineDataListProps) {
  const items = Children.toArray(children).filter(isValidElement);

  const containerClasses = stackOnMobile
    ? `flex flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1 text-sm`
    : `flex flex-wrap items-center gap-x-4 gap-y-1 text-sm`;

  return (
    <div className={className}>
      {title && (
        <div className="text-sm font-semibold mb-1">{title}</div>
      )}
      <div
        className={`${containerClasses} ${
          bordered ? 'pb-2 border-b border-pkt-border-subtle' : ''
        }`}
      >
        {items.map((child, index) => (
          <span key={index} className={stackOnMobile ? 'sm:contents' : 'contents'}>
            {child}
            {index < items.length - 1 && (
              <span className={`text-pkt-text-body-subtle font-medium ${stackOnMobile ? 'hidden sm:inline' : ''}`}>|</span>
            )}
          </span>
        ))}
      </div>
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
      {label && (
        <>
          <span className={variant === 'default' ? 'text-pkt-text-body-subtle' : ''}>
            {label}:
          </span>{' '}
        </>
      )}
      <span className={valueClasses}>{children}</span>
    </span>
  );
}
