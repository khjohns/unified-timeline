/**
 * Table Component
 *
 * A generic table component for displaying tabular data.
 * Follows the design system with Oslo design tokens.
 *
 * @example
 * ```tsx
 * const columns: Column<User>[] = [
 *   { key: 'name', label: 'Name', render: (user) => user.name },
 *   { key: 'email', label: 'Email', align: 'left', render: (user) => user.email },
 *   { key: 'count', label: 'Count', align: 'center', render: (user) => user.count },
 * ];
 *
 * <Table
 *   columns={columns}
 *   data={users}
 *   keyExtractor={(user) => user.id}
 *   onRowClick={(user) => navigate(`/users/${user.id}`)}
 * />
 * ```
 */

import { ReactNode } from 'react';
import clsx from 'clsx';

export type ColumnAlign = 'left' | 'center' | 'right';

export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Column header label */
  label: string;
  /** Optional fixed width (e.g., '120px', '20%') */
  width?: string;
  /** Text alignment (default: 'left') */
  align?: ColumnAlign;
  /** Render function for cell content */
  render: (item: T, index: number) => ReactNode;
}

interface TableProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Data array to display */
  data: T[];
  /** Function to extract unique key from each item */
  keyExtractor: (item: T, index: number) => string;
  /** Callback when a row is clicked */
  onRowClick?: (item: T, index: number) => void;
  /** Message to show when data is empty */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

const alignClasses: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Ingen data',
  className = '',
}: TableProps<T>) {
  const isClickable = !!onRowClick;

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-pkt-border-subtle bg-pkt-surface-strong-gray">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={clsx(
                  'px-4 py-3 text-sm font-medium text-pkt-text-body-subtle',
                  alignClasses[col.align ?? 'left']
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-pkt-border-subtle">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-pkt-text-body-subtle"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, idx) => (
              <tr
                key={keyExtractor(item, idx)}
                onClick={onRowClick ? () => onRowClick(item, idx) : undefined}
                className={clsx(
                  'hover:bg-pkt-surface-subtle transition-colors',
                  isClickable && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      'px-4 py-3 text-sm text-pkt-text-body-default',
                      alignClasses[col.align ?? 'left']
                    )}
                  >
                    {col.render(item, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
