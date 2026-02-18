import { clsx } from 'clsx';
import * as Popover from '@radix-ui/react-popover';
import { CalendarIcon } from '@radix-ui/react-icons';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { useState } from 'react';
import 'react-day-picker/style.css';

export interface InlineDatePickerProps {
  label: string;
  subtitle?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function InlineDatePicker({
  label,
  subtitle,
  value,
  onChange,
  helperText,
  error,
  disabled,
  className,
}: InlineDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(value) : undefined;
  const displayValue = selectedDate ? format(selectedDate, 'dd.MM.yyyy', { locale: nb }) : '';

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
    }
    setOpen(false);
  };

  return (
    <div className={clsx('space-y-1', className)}>
      <div className="flex justify-between items-center">
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-bento-caption text-pkt-text-body-subtle truncate">{label}</span>
          {subtitle && (
            <span className="text-bento-label text-pkt-text-body-muted flex-shrink-0">{subtitle}</span>
          )}
        </div>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={clsx(
                'flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-bento-body font-mono tabular-nums transition-colors',
                error
                  ? 'border-pkt-brand-red-1000 focus:ring-pkt-brand-red-1000/20'
                  : 'border-pkt-border-default focus:border-pkt-brand-warm-blue-1000 focus:ring-pkt-brand-warm-blue-1000/20',
                'bg-pkt-bg-default focus:outline-none focus:ring-2',
                disabled && 'opacity-50 cursor-not-allowed',
                !disabled && 'cursor-pointer',
                !displayValue && 'text-pkt-text-placeholder',
              )}
            >
              <span className="text-right min-w-[5.5rem]">{displayValue || 'Velg dato'}</span>
              <CalendarIcon className="w-3.5 h-3.5 shrink-0 text-pkt-text-body-subtle" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={4}
              collisionPadding={16}
              avoidCollisions
              className={clsx(
                'z-popover bg-pkt-bg-card border border-pkt-border-default rounded shadow-lg p-4',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              )}
            >
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleSelect}
                locale={nb}
                showOutsideDays
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {helperText && !error && (
        <p className="text-bento-label text-pkt-text-body-muted text-right">{helperText}</p>
      )}
      {error && (
        <p className="text-bento-label text-pkt-brand-red-1000 text-right">{error}</p>
      )}
    </div>
  );
}
