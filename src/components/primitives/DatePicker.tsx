import * as Popover from '@radix-ui/react-popover';
import { CalendarIcon } from '@radix-ui/react-icons';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { forwardRef, useState } from 'react';
import clsx from 'clsx';
import 'react-day-picker/style.css';

export interface DatePickerProps {
  /** Selected date value (ISO string YYYY-MM-DD) */
  value?: string;
  /** Callback when date changes */
  onChange?: (date: string) => void;
  /** Whether the input has an error state */
  error?: boolean;
  /** Full width input */
  fullWidth?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Input id */
  id?: string;
  /** Input name */
  name?: string;
}

/**
 * DatePicker component with Radix UI Popover and react-day-picker
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859)
 * - Calendar opens right below the input field
 * - Norwegian locale
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      error,
      fullWidth,
      disabled,
      placeholder = 'Velg dato',
      id,
      name,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);

    // Parse the ISO string to Date object
    const selectedDate = value ? new Date(value) : undefined;

    const handleSelect = (date: Date | undefined) => {
      if (date && onChange) {
        // Format as YYYY-MM-DD for form compatibility
        const isoDate = format(date, 'yyyy-MM-dd');
        onChange(isoDate);
      }
      setOpen(false);
    };

    const displayValue = selectedDate
      ? format(selectedDate, 'dd.MM.yyyy', { locale: nb })
      : '';

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={clsx(
              // Base styles
              'flex items-center justify-between gap-2',
              'px-pkt-04 py-pkt-03',
              'text-base font-normal text-left',
              'bg-pkt-bg-default',
              'transition-colors duration-200',

              // Border - 2px width, sharp corners
              'border-2 rounded-none',

              // Default border color
              !error && !disabled && 'border-pkt-border-default',

              // Error state
              error && 'border-pkt-border-red',

              // Disabled state
              disabled && [
                'border-pkt-border-disabled',
                'bg-pkt-surface-gray',
                'text-pkt-text-action-disabled',
                'cursor-not-allowed',
              ],

              // Focus state
              !disabled && [
                'focus:outline-none',
                'focus:ring-4',
                error
                  ? 'focus:ring-pkt-brand-red-400/50 focus:border-pkt-border-red'
                  : 'focus:ring-pkt-brand-purple-1000/30 focus:border-pkt-border-focus',
              ],

              // Hover state
              !disabled && 'hover:border-pkt-border-hover',

              // Width
              fullWidth && 'w-full',

              // Placeholder color
              !displayValue && 'text-pkt-text-placeholder'
            )}
          >
            <span>{displayValue || placeholder}</span>
            <CalendarIcon className="h-5 w-5 shrink-0" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className={clsx(
              'z-popover',
              'bg-pkt-bg-card',
              'border-2 border-pkt-border-default rounded-none',
              'shadow-xl',
              'p-pkt-04',
              // Animations
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
            )}
          >
            <style>{`
              /* Punkt design system styling for DayPicker */
              .rdp {
                --rdp-accent-color: var(--color-pkt-surface-strong-dark-blue);
                --rdp-background-color: var(--color-pkt-surface-light-blue);
                --rdp-font-family: 'Oslo Sans', system-ui, sans-serif;
              }

              .rdp-months {
                font-size: 16px;
              }

              .rdp-month_caption {
                font-size: 18px;
                font-weight: 700;
                color: var(--color-pkt-text-body-dark);
                margin-bottom: 1rem;
              }

              .rdp-weekday {
                font-size: 14px;
                font-weight: 500;
                color: var(--color-pkt-text-body-dark);
              }

              .rdp-day {
                font-size: 16px;
                width: 36px;
                height: 36px;
                border-radius: 0;
              }

              .rdp-day_button:hover:not([disabled]) {
                background-color: var(--color-pkt-surface-light-blue);
              }

              .rdp-day_selected {
                background-color: var(--color-pkt-surface-strong-dark-blue);
                color: var(--color-pkt-text-body-light);
                font-weight: 600;
              }

              .rdp-day_today {
                font-weight: 700;
                color: var(--color-pkt-brand-warm-blue-1000);
              }

              .rdp-nav button {
                width: 36px;
                height: 36px;
                border-radius: 0;
              }

              .rdp-nav button:hover {
                background-color: var(--color-pkt-surface-light-blue);
              }
            `}</style>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              locale={nb}
              showOutsideDays
            />
          </Popover.Content>
        </Popover.Portal>

        {/* Hidden input for form compatibility */}
        <input
          ref={ref}
          type="hidden"
          value={value || ''}
          name={name}
          id={id}
        />
      </Popover.Root>
    );
  }
);

DatePicker.displayName = 'DatePicker';
