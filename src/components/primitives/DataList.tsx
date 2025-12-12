/**
 * DataList Component
 *
 * A simple key-value display component inspired by Radix UI DataList.
 * Used for displaying metadata in a clean, consistent format.
 */

import { ReactNode } from 'react';

interface DataListProps {
  children: ReactNode;
  className?: string;
}

interface DataListItemProps {
  label: string;
  children: ReactNode;
}

/**
 * Container for the data list
 */
export function DataList({ children, className = '' }: DataListProps) {
  return (
    <dl className={`divide-y divide-pkt-border-subtle ${className}`}>
      {children}
    </dl>
  );
}

/**
 * Individual item in the data list with label and value
 */
export function DataListItem({ label, children }: DataListItemProps) {
  return (
    <div className="py-2.5 flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-sm text-pkt-grays-gray-600 sm:w-40 sm:flex-shrink-0">
        {label}
      </dt>
      <dd className="text-sm text-pkt-text-body-default mt-1 sm:mt-0">
        {children}
      </dd>
    </div>
  );
}
