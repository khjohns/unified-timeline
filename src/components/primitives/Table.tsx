/**
 * Table Component
 *
 * A generic table component for displaying tabular data.
 * Supports sorting and filtering with an intuitive UI.
 *
 * @example
 * ```tsx
 * const columns: Column<User>[] = [
 *   { key: 'name', label: 'Name', sortable: true, render: (user) => user.name },
 *   { key: 'status', label: 'Status', filterable: true, filterType: 'select',
 *     filterOptions: [{ value: 'active', label: 'Active' }], render: (user) => user.status },
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

import { ReactNode, useState, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronUpIcon, ChevronDownIcon, MixerHorizontalIcon, MagnifyingGlassIcon, Cross2Icon } from '@radix-ui/react-icons';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

export type ColumnAlign = 'left' | 'center' | 'right';
export type SortDirection = 'asc' | 'desc';
export type FilterType = 'text' | 'select';

export interface FilterOption {
  value: string;
  label: string;
}

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

  // Sorting
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Custom sort function. Default: string comparison with localeCompare */
  sortFn?: (a: T, b: T, direction: SortDirection) => number;

  // Filtering
  /** Enable filtering for this column */
  filterable?: boolean;
  /** Filter type: 'text' for search, 'select' for dropdown */
  filterType?: FilterType;
  /** Options for select filter */
  filterOptions?: FilterOption[];
  /** Custom filter function. Default: case-insensitive includes */
  filterFn?: (item: T, filterValue: string) => boolean;
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
  /** Default sort column key */
  defaultSortKey?: string;
  /** Default sort direction */
  defaultSortDirection?: SortDirection;
}

// ============================================================================
// Helper Components
// ============================================================================

const alignClasses: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

interface SortIconProps {
  direction: SortDirection | null;
  isActive: boolean;
}

function SortIcon({ direction, isActive }: SortIconProps) {
  if (!isActive || !direction) {
    return (
      <ChevronUpIcon className="w-4 h-4 text-pkt-text-body-muted opacity-0 group-hover:opacity-50 transition-opacity" />
    );
  }

  return direction === 'asc' ? (
    <ChevronUpIcon className="w-4 h-4 text-pkt-text-body-dark" />
  ) : (
    <ChevronDownIcon className="w-4 h-4 text-pkt-text-body-dark" />
  );
}

interface FilterPopoverProps {
  column: Column<unknown>;
  value: string;
  onChange: (value: string) => void;
}

function FilterPopover({ column, value, onChange }: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const hasActiveFilter = value !== '';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={clsx(
            'relative p-1 rounded hover:bg-pkt-surface-subtle transition-colors',
            hasActiveFilter && 'text-pkt-brand-dark-blue-1000'
          )}
          aria-label={`Filter ${column.label}`}
        >
          <MixerHorizontalIcon className="w-4 h-4" />
          {hasActiveFilter && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-pkt-brand-dark-blue-1000" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={clsx(
            'z-50 min-w-[180px] rounded border border-pkt-border-default bg-pkt-bg-card p-2 shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <div className="space-y-2">
            <div className="text-xs font-medium text-pkt-text-body-subtle px-1">
              Filtrer {column.label.toLowerCase()}
            </div>

            {column.filterType === 'text' && (
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-pkt-text-body-muted" />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Søk..."
                  className={clsx(
                    'w-full pl-8 pr-2 py-1.5 text-sm rounded border border-pkt-border-default',
                    'bg-pkt-bg-default focus:outline-none focus:border-pkt-border-focus'
                  )}
                  autoFocus
                />
              </div>
            )}

            {column.filterType === 'select' && column.filterOptions && (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {column.filterOptions.map((option) => (
                  <label
                    key={option.value}
                    className={clsx(
                      'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer',
                      'hover:bg-pkt-surface-subtle transition-colors text-sm'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={value.split(',').filter(Boolean).includes(option.value)}
                      onChange={(e) => {
                        const currentValues = value.split(',').filter(Boolean);
                        if (e.target.checked) {
                          onChange([...currentValues, option.value].join(','));
                        } else {
                          onChange(currentValues.filter((v) => v !== option.value).join(','));
                        }
                      }}
                      className="w-4 h-4 rounded border-pkt-border-default text-pkt-brand-dark-blue-1000
                                 focus:ring-2 focus:ring-pkt-border-focus focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-pkt-text-body-default">{option.label}</span>
                  </label>
                ))}
              </div>
            )}

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs',
                  'text-pkt-text-body-muted hover:text-pkt-text-body-default',
                  'border-t border-pkt-border-subtle mt-2 pt-2'
                )}
              >
                <Cross2Icon className="w-3 h-3" />
                Nullstill
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Ingen data',
  className = '',
  defaultSortKey,
  defaultSortDirection = 'asc',
}: TableProps<T>) {
  const isClickable = !!onRowClick;

  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  // Filter state
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Handle sort click
  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    if (sortKey === column.key) {
      // Toggle direction or clear
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
      }
    } else {
      setSortKey(column.key);
      setSortDirection('asc');
    }
  };

  // Handle filter change
  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Process data: filter then sort
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    for (const column of columns) {
      const filterValue = filters[column.key];
      if (!filterValue || !column.filterable) continue;

      if (column.filterFn) {
        result = result.filter((item) => column.filterFn!(item, filterValue));
      } else if (column.filterType === 'text') {
        // Default text filter: case-insensitive includes on rendered content
        result = result.filter((item) => {
          const rendered = column.render(item, 0);
          const textContent = typeof rendered === 'string' ? rendered : String(rendered);
          return textContent.toLowerCase().includes(filterValue.toLowerCase());
        });
      } else if (column.filterType === 'select') {
        // Default select filter: match any selected value
        const selectedValues = filterValue.split(',').filter(Boolean);
        if (selectedValues.length > 0) {
          result = result.filter((item) => {
            const rendered = column.render(item, 0);
            const textContent = typeof rendered === 'string' ? rendered : String(rendered);
            return selectedValues.some((v) => textContent.toLowerCase().includes(v.toLowerCase()));
          });
        }
      }
    }

    // Apply sorting
    if (sortKey) {
      const sortColumn = columns.find((c) => c.key === sortKey);
      if (sortColumn) {
        result.sort((a, b) => {
          if (sortColumn.sortFn) {
            return sortColumn.sortFn(a, b, sortDirection);
          }
          // Default sort: string comparison on rendered content
          const aRendered = sortColumn.render(a, 0);
          const bRendered = sortColumn.render(b, 0);
          const aText = typeof aRendered === 'string' ? aRendered : String(aRendered);
          const bText = typeof bRendered === 'string' ? bRendered : String(bRendered);
          const comparison = aText.localeCompare(bText, 'nb');
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    return result;
  }, [data, columns, filters, sortKey, sortDirection]);

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-pkt-border-subtle bg-pkt-surface-strong-gray">
            {columns.map((col) => {
              const isSortable = col.sortable;
              const isFilterable = col.filterable;
              const isSorted = sortKey === col.key;

              return (
                <th
                  key={col.key}
                  scope="col"
                  className={clsx(
                    'px-4 py-3 text-sm font-medium text-pkt-text-body-subtle',
                    alignClasses[col.align ?? 'left']
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <div className={clsx(
                    'flex items-center gap-1',
                    col.align === 'center' && 'justify-center',
                    col.align === 'right' && 'justify-end'
                  )}>
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className={clsx(
                          'group flex items-center gap-1 hover:text-pkt-text-body-default transition-colors',
                          isSorted && 'text-pkt-text-body-dark'
                        )}
                      >
                        <span>{col.label}</span>
                        <SortIcon direction={isSorted ? sortDirection : null} isActive={isSorted} />
                      </button>
                    ) : (
                      <span>{col.label}</span>
                    )}

                    {isFilterable && (
                      <FilterPopover
                        column={col as Column<unknown>}
                        value={filters[col.key] ?? ''}
                        onChange={(value) => handleFilterChange(col.key, value)}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-pkt-border-subtle">
          {processedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-pkt-text-body-subtle"
              >
                {hasActiveFilters ? 'Ingen treff med valgte filtre' : emptyMessage}
              </td>
            </tr>
          ) : (
            processedData.map((item, idx) => (
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
