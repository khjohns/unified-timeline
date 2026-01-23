import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from '@radix-ui/react-icons';
import { forwardRef, ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';

export interface CheckboxProps extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /** Label text to display next to the checkbox */
  label?: string;
  /** Description text to display below the label */
  description?: string;
  /** Error state */
  error?: boolean;
}

/**
 * Checkbox component based on Radix UI Checkbox
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859)
 * - Larger size for better clickability
 * - Focus state with pkt-border-focus (#e0adff)
 */
export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, error, ...props }, ref) => {
  const checkbox = (
    <CheckboxPrimitive.Root
      ref={ref}
      className={clsx(
        // Size - 26x26px for WCAG 2.5.8 Target Size (Minimum) compliance with margin
        'h-[26px] w-[26px]',
        'shrink-0',

        // Base styles
        'border-2 rounded-sm',
        'transition-colors duration-200',

        // Default state
        'bg-pkt-bg-default',
        !error && 'border-pkt-border-default',

        // Error state
        error && 'border-pkt-border-red',

        // Checked state
        'data-[state=checked]:bg-pkt-surface-strong-dark-blue',
        'data-[state=checked]:border-pkt-surface-strong-dark-blue',

        // Focus state
        'focus:outline-none',
        'focus:ring-4',
        error
          ? 'focus:ring-pkt-brand-red-400/50'
          : 'focus:ring-pkt-brand-purple-1000/30',

        // Hover state
        'hover:border-pkt-border-hover',

        // Disabled state
        'disabled:cursor-not-allowed',
        'disabled:border-pkt-border-disabled',
        'disabled:bg-pkt-surface-gray',
        'data-[state=checked]:disabled:bg-pkt-border-disabled',

        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-pkt-text-body-light">
        <CheckIcon className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (label) {
    return (
      <div className="flex items-start gap-3">
        <div className="mt-px">{checkbox}</div>
        <div className="flex flex-col">
          <label
            htmlFor={props.id}
            className={clsx(
              'text-sm font-normal cursor-pointer',
              'text-pkt-text-body-default',
              props.disabled && 'cursor-not-allowed text-pkt-text-action-disabled'
            )}
          >
            {label}
          </label>
          {description && (
            <span className="text-sm text-pkt-text-body-subtle">{description}</span>
          )}
        </div>
      </div>
    );
  }

  return checkbox;
});

Checkbox.displayName = 'Checkbox';
