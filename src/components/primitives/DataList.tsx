/**
 * DataList Component
 *
 * A simple key-value display component inspired by Radix UI DataList.
 * Used for displaying metadata in a clean, consistent format.
 *
 * Supports two variants:
 * - 'list' (default): Single column with label to the left of value
 * - 'grid': Two columns with label above value
 */

import { ReactNode, createContext, useContext } from 'react';

type DataListVariant = 'list' | 'grid';

const DataListContext = createContext<{ variant: DataListVariant }>({ variant: 'list' });

interface DataListProps {
  children: ReactNode;
  className?: string;
  variant?: DataListVariant;
}

interface DataListItemProps {
  label: string;
  children: ReactNode;
}

/**
 * Container for the data list
 */
export function DataList({ children, className = '', variant = 'list' }: DataListProps) {
  if (variant === 'grid') {
    return (
      <DataListContext.Provider value={{ variant }}>
        <dl className={`grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 ${className}`}>
          {children}
        </dl>
      </DataListContext.Provider>
    );
  }

  return (
    <DataListContext.Provider value={{ variant }}>
      <dl className={`divide-y divide-pkt-border-subtle ${className}`}>
        {children}
      </dl>
    </DataListContext.Provider>
  );
}

/**
 * Individual item in the data list with label and value
 */
export function DataListItem({ label, children }: DataListItemProps) {
  const { variant } = useContext(DataListContext);

  if (variant === 'grid') {
    return (
      <div className="flex flex-col">
        <dt className="text-sm text-pkt-grays-gray-600 mb-0.5">
          {label}
        </dt>
        <dd className="text-sm text-pkt-text-body-default">
          {children}
        </dd>
      </div>
    );
  }

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
