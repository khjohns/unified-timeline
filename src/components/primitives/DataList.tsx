/**
 * DataList Component
 *
 * A simple key-value display component inspired by Radix UI DataList.
 * Used for displaying metadata in a clean, consistent format.
 *
 * Supports two variants:
 * - 'list' (default): Single column with label to the left of value
 * - 'grid': Two columns with label above value
 *
 * Supports alignment:
 * - 'left' (default): Value flows after label
 * - 'right': Value is right-aligned (justify-between)
 */

import { ReactNode, createContext, useContext } from 'react';

type DataListVariant = 'list' | 'grid';
type DataListAlign = 'left' | 'right';

const DataListContext = createContext<{ variant: DataListVariant; align: DataListAlign }>({
  variant: 'list',
  align: 'left',
});

interface DataListProps {
  children: ReactNode;
  className?: string;
  variant?: DataListVariant;
  /** Alignment of values - 'right' uses justify-between layout */
  align?: DataListAlign;
}

interface DataListItemProps {
  label: string;
  children: ReactNode;
  /** Use monospace font for the value (good for numbers) */
  mono?: boolean;
}

/**
 * Container for the data list
 */
export function DataList({ children, className = '', variant = 'list', align = 'left' }: DataListProps) {
  if (variant === 'grid') {
    return (
      <DataListContext.Provider value={{ variant, align }}>
        <dl className={`grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 ${className}`}>
          {children}
        </dl>
      </DataListContext.Provider>
    );
  }

  return (
    <DataListContext.Provider value={{ variant, align }}>
      <dl className={`divide-y divide-pkt-border-subtle ${className}`}>
        {children}
      </dl>
    </DataListContext.Provider>
  );
}

/**
 * Individual item in the data list with label and value
 */
export function DataListItem({ label, children, mono }: DataListItemProps) {
  const { variant, align } = useContext(DataListContext);

  const valueClasses = `text-sm text-pkt-text-body-default ${mono ? 'font-mono' : ''}`;

  if (variant === 'grid') {
    return (
      <div className="flex flex-col">
        <dt className="text-sm text-pkt-text-body-subtle mb-0.5">
          {label}
        </dt>
        <dd className={valueClasses}>
          {children}
        </dd>
      </div>
    );
  }

  // Right-aligned variant: label left, value right (justify-between)
  if (align === 'right') {
    return (
      <div className="py-2 flex justify-between items-center">
        <dt className="text-sm font-medium text-pkt-text-body-default">
          {label}
        </dt>
        <dd className={valueClasses}>
          {children}
        </dd>
      </div>
    );
  }

  // Default left-aligned variant
  return (
    <div className="py-2.5 flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-sm text-pkt-text-body-subtle sm:w-40 sm:flex-shrink-0">
        {label}
      </dt>
      <dd className={`${valueClasses} mt-1 sm:mt-0`}>
        {children}
      </dd>
    </div>
  );
}
