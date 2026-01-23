import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarIcon, Cross2Icon } from '@radix-ui/react-icons';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import 'react-day-picker/style.css';

export type DateRangePickerWidth = 'sm' | 'md' | 'lg' | 'full';

/**
 * Width classes for semantic sizing:
 * - sm: fits single date (dd.mm.yyyy)
 * - md: fits date range comfortably (default)
 * - lg: extra wide
 * - full: 100% width
 */
const WIDTH_CLASSES: Record<DateRangePickerWidth, string> = {
  sm: 'w-36',      // 9rem
  md: 'w-56',      // 14rem - fits "dd.mm.yyyy – dd.mm.yyyy"
  lg: 'w-72',      // 18rem
  full: 'w-full',
};

export interface DateRangeValue {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export interface DateRangePickerProps {
  /** Selected date range values (ISO strings YYYY-MM-DD) */
  value?: DateRangeValue;
  /** Callback when date range changes */
  onChange?: (range: DateRangeValue) => void;
  /** Whether the input has an error state */
  error?: boolean;
  /** Semantic width of the picker (default: 'md') */
  width?: DateRangePickerWidth;
  /** Disabled state */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Input id */
  id?: string;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

/** Hook to detect mobile screen size */
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

/** Shared calendar styles for Punkt design system */
const calendarStyles = `
  /* Punkt design system - override all rdp CSS variables */
  .rdp {
    --rdp-accent-color: var(--color-pkt-text-body-dark);
    --rdp-accent-background-color: var(--color-pkt-surface-strong-dark-blue);
    --rdp-range_middle-background-color: var(--color-pkt-surface-light-blue);
    --rdp-range_middle-color: var(--color-pkt-text-body-dark);
    --rdp-today-color: var(--color-pkt-text-body-dark);
    --rdp-selected-border: none;
    --rdp-selected-font: inherit;
    --rdp-font-family: 'Oslo Sans', system-ui, sans-serif;
  }

  .rdp-months {
    font-size: 16px;
  }

  .rdp-month_caption {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-pkt-text-body-dark);
    margin-bottom: 16px;
  }

  .rdp-weekday {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-pkt-text-body-dark);
  }

  .rdp-day {
    font-size: 16px;
    width: 40px;
    height: 40px;
    border-radius: 0 !important;
    background: transparent !important;
  }

  .rdp-day_button {
    width: 40px;
    height: 40px;
    border: none !important;
    border-radius: 0 !important;
  }

  .rdp-day_button:hover:not([disabled]) {
    background-color: var(--color-pkt-surface-light-blue) !important;
  }

  /* Range middle - same color as endpoints for continuous band */
  .rdp-range_middle {
    background-color: var(--color-pkt-surface-strong-dark-blue) !important;
    border-radius: 0 !important;
  }

  .rdp-range_middle .rdp-day_button {
    color: var(--color-pkt-text-body-light) !important;
    background-color: transparent !important;
    border-radius: 0 !important;
  }

  /* Selected / Range start / Range end - full circle */
  .rdp-selected .rdp-day_button,
  .rdp-range_start .rdp-day_button,
  .rdp-range_end .rdp-day_button {
    background-color: var(--color-pkt-surface-strong-dark-blue) !important;
    color: var(--color-pkt-text-body-light) !important;
    font-weight: 600;
    border: none !important;
    border-radius: 50% !important;
  }

  .rdp-today,
  .rdp-today .rdp-day_button {
    font-weight: 700;
    color: var(--color-pkt-text-body-dark) !important;
  }

  .rdp-nav button {
    width: 40px;
    height: 40px;
    border-radius: 50% !important;
    color: var(--color-pkt-text-body-dark) !important;
  }

  .rdp-nav button:hover {
    background-color: var(--color-pkt-surface-light-blue) !important;
    color: var(--color-pkt-text-body-dark) !important;
  }

  .rdp-nav button svg {
    color: inherit !important;
    fill: currentColor !important;
  }

  /* ===== DARK MODE ===== */
  .dark .rdp {
    --rdp-accent-color: var(--color-pkt-text-body-default);
    --rdp-accent-background-color: var(--color-pkt-brand-warm-blue-1000);
    --rdp-range_middle-background-color: var(--color-pkt-grays-gray-200);
    --rdp-range_middle-color: var(--color-pkt-text-body-default);
    --rdp-today-color: var(--color-pkt-text-body-default);
  }

  .dark .rdp-day_button:hover:not([disabled]) {
    background-color: var(--color-pkt-grays-gray-200) !important;
  }

  /* Dark: Range middle - same color as endpoints */
  .dark .rdp-range_middle {
    background-color: var(--color-pkt-brand-warm-blue-1000) !important;
    border-radius: 0 !important;
  }

  .dark .rdp-range_middle .rdp-day_button {
    color: var(--color-pkt-bg-default) !important;
    background-color: transparent !important;
    border-radius: 0 !important;
  }

  /* Dark: Selected / Range start / Range end - full circle */
  .dark .rdp-selected .rdp-day_button,
  .dark .rdp-range_start .rdp-day_button,
  .dark .rdp-range_end .rdp-day_button {
    background-color: var(--color-pkt-brand-warm-blue-1000) !important;
    color: var(--color-pkt-bg-default) !important;
    border: none !important;
    border-radius: 50% !important;
  }

  .dark .rdp-nav button {
    color: var(--color-pkt-text-body-default) !important;
  }

  .dark .rdp-nav button:hover {
    background-color: var(--color-pkt-grays-gray-200) !important;
    color: var(--color-pkt-text-body-default) !important;
  }

  .dark .rdp-nav button svg {
    color: inherit !important;
    fill: currentColor !important;
  }

  .dark .rdp-today,
  .dark .rdp-today .rdp-day_button {
    color: var(--color-pkt-text-body-default) !important;
  }
`;

/**
 * DateRangePicker component for selecting a date range
 * - Uses react-day-picker in range mode
 * - Sharp corners (radius: 0)
 * - On mobile: Uses full-screen modal
 * - On desktop: Uses popover
 * - Norwegian locale
 */
export function DateRangePicker({
  value,
  onChange,
  error,
  width = 'md',
  disabled,
  placeholder = 'Velg periode',
  id,
  'data-testid': dataTestId,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  // Track if we've started selecting a new range (first date clicked)
  const [selectionStarted, setSelectionStarted] = useState(false);
  const isMobile = useIsMobile();

  // Reset selection state when popover opens
  useEffect(() => {
    if (open) {
      setSelectionStarted(false);
    }
  }, [open]);

  // Parse ISO strings to DateRange object
  const selectedRange: DateRange | undefined =
    value?.from || value?.to
      ? {
          from: value.from ? new Date(value.from) : undefined,
          to: value.to ? new Date(value.to) : undefined,
        }
      : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    const isFirstSelection = range?.from && !range?.to;
    const isCompleteSelection = range?.from && range?.to;

    if (onChange) {
      onChange({
        from: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
        to: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
      });
    }

    // Mark that user has started a new selection (clicked first date)
    if (isFirstSelection) {
      setSelectionStarted(true);
    }

    // Only close after completing a newly started selection
    if (isCompleteSelection && selectionStarted) {
      setOpen(false);
    }
  };

  // Format display value
  const formatDisplayValue = () => {
    if (!value?.from && !value?.to) return '';
    const fromStr = value.from
      ? format(new Date(value.from), 'dd.MM.yyyy', { locale: nb })
      : '...';
    const toStr = value.to
      ? format(new Date(value.to), 'dd.MM.yyyy', { locale: nb })
      : '...';
    return `${fromStr} – ${toStr}`;
  };

  const displayValue = formatDisplayValue();

  // Trigger button styles
  const triggerClassName = clsx(
    // Base styles
    'flex items-center justify-between gap-2',
    'px-4 py-3',
    'text-base font-normal text-left',
    'bg-pkt-bg-default',
    'transition-colors duration-200',

    // Border - 2px width, standard radius
    'border-2 rounded',

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

    // Semantic width
    WIDTH_CLASSES[width],

    // Placeholder color
    !displayValue && 'text-pkt-text-placeholder'
  );

  // Calendar component
  const calendarContent = (
    <>
      <style>{calendarStyles}</style>
      <DayPicker
        mode="range"
        selected={selectedRange}
        onSelect={handleSelect}
        locale={nb}
        showOutsideDays
        numberOfMonths={isMobile ? 1 : 2}
      />
    </>
  );

  // Mobile: Use full-screen modal
  if (isMobile) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={triggerClassName}
            data-testid={dataTestId}
            id={id}
          >
            <span>{displayValue || placeholder}</span>
            <CalendarIcon className="h-5 w-5 shrink-0" />
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          {/* Overlay */}
          <Dialog.Overlay
            className={clsx(
              'fixed inset-0 bg-black/50 backdrop-blur-sm',
              'z-modal-backdrop',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
            )}
          />

          {/* Content - Bottom sheet style on mobile */}
          <Dialog.Content
            className={clsx(
              'fixed inset-x-0 bottom-0',
              'bg-pkt-bg-card rounded shadow-lg',
              'border-t border-pkt-border-default',
              'p-6 pb-8',
              'z-modal',
              'focus:outline-none',
              // Slide up animation
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold text-pkt-text-body-dark">
                Velg periode
              </Dialog.Title>
              <Dialog.Close
                className={clsx(
                  'rounded p-2',
                  'text-pkt-text-body-subtle hover:text-pkt-text-body-default',
                  'hover:bg-pkt-surface-light-beige',
                  'focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30'
                )}
                aria-label="Lukk"
              >
                <Cross2Icon className="w-5 h-5" />
              </Dialog.Close>
            </div>

            {/* Calendar - centered */}
            <div className="flex justify-center overflow-x-auto">
              {calendarContent}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  // Desktop: Use popover
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={triggerClassName}
          data-testid={dataTestId}
          id={id}
        >
          <span>{displayValue || placeholder}</span>
          <CalendarIcon className="h-5 w-5 shrink-0" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={16}
          avoidCollisions
          className={clsx(
            'z-popover',
            'bg-pkt-bg-card',
            'border border-pkt-border-default rounded',
            'shadow-lg',
            'p-4',
            // Animations
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          {calendarContent}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
