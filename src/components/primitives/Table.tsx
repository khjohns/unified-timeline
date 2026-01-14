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
 *   { key: 'email', label: 'Email', render: (user) => user.email },
 * ];
 *
 * <Table
 *   columns={columns}
 *   data={users}
 *   keyExtractor={(user) => user.id}
 * />
 * ```
 */

import { ReactNode } from 'react';

export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Column header label */
  label: string;
  /** Optional fixed width (e.g., '120px', '20%') */
  width?: string;
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
  /** Message to show when data is empty */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'Ingen data',
  className = '',
}: TableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-pkt-border-subtle">
        <thead className="bg-pkt-surface-strong-gray">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold text-pkt-text-heading uppercase tracking-wider"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-pkt-surface divide-y divide-pkt-border-subtle">
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
                className="hover:bg-pkt-surface-subtle transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-sm text-pkt-text-body-default"
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
