import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarIcon, Cross2Icon } from '@radix-ui/react-icons';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { forwardRef, useState, useEffect } from 'react';
import clsx from 'clsx';
import 'react-day-picker/style.css';

export type DatePickerWidth = 'sm' | 'md' | 'full';

/**
 * Width classes for semantic sizing:
 * - sm: ~12 chars (e.g., dd.mm.yyyy format)
 * - md: ~16 chars (with some padding)
 * - full: 100% width
 */
const WIDTH_CLASSES: Record<DatePickerWidth, string> = {
  sm: 'w-36',      // 9rem = fits dd.mm.yyyy comfortably
  md: 'w-48',      // 12rem = extra breathing room
  full: 'w-full',
};

export interface DatePickerProps {
  /** Selected date value (ISO string YYYY-MM-DD) */
  value?: string;
  /** Callback when date changes */
  onChange?: (date: string) => void;
  /** Whether the input has an error state */
  error?: boolean;
  /** Full width input (deprecated, use width="full" instead) */
  fullWidth?: boolean;
  /** Semantic width of the date picker (default: 'sm') */
  width?: DatePickerWidth;
  /** Disabled state */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Input id */
  id?: string;
  /** Input name */
  name?: string;
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

  /* Selected state - full circle */
  .rdp-selected .rdp-day_button {
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
    --rdp-today-color: var(--color-pkt-text-body-default);
  }

  .dark .rdp-day_button:hover:not([disabled]) {
    background-color: var(--color-pkt-grays-gray-200) !important;
  }

  /* Dark: Selected state - full circle */
  .dark .rdp-selected .rdp-day_button {
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
 * DatePicker component with Radix UI Popover and react-day-picker
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859)
 * - On mobile: Uses full-screen modal for better UX
 * - On desktop: Uses popover positioned below the input
 * - Norwegian locale
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      error,
      fullWidth,
      width = 'sm', // Default to small width for dates
      disabled,
      placeholder = 'Velg dato',
      id,
      name,
      'data-testid': dataTestId,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const isMobile = useIsMobile();

    // Determine width class (fullWidth overrides width prop for backwards compat)
    const widthClass = fullWidth ? 'w-full' : WIDTH_CLASSES[width];

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

    // Trigger button styles (shared between mobile and desktop)
    const triggerClassName = clsx(
      // Base styles
      'flex items-center justify-between gap-2',
      'px-4 py-3',
      'text-base font-normal text-left',
      'bg-pkt-bg-default',
      'transition-colors duration-200',

      // Border - 2px width, sharp corners
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

      // Width
      widthClass,

      // Placeholder color
      !displayValue && 'text-pkt-text-placeholder'
    );

    // Calendar component (shared between mobile and desktop)
    const calendarContent = (
      <>
        <style>{calendarStyles}</style>
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={nb}
          showOutsideDays
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
                  Velg dato
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
              <div className="flex justify-center">
                {calendarContent}
              </div>
            </Dialog.Content>
          </Dialog.Portal>

          {/* Hidden input for form compatibility */}
          <input
            ref={ref}
            type="hidden"
            value={value || ''}
            name={name}
            id={id}
          />
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
