import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { forwardRef, ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';

export interface RadioGroupProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  error?: boolean;
}

export interface RadioItemProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  label?: string;
  error?: boolean;
}

/**
 * RadioGroup component based on Radix UI RadioGroup
 * - Sharp corners (radius: 0 for container, circular indicators)
 * - border-pkt-border-default (#2a2859)
 * - Larger size for better clickability
 * - Focus state with pkt-border-focus (#e0adff)
 */

export const RadioGroup = forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={clsx('flex flex-col gap-pkt-03', className)}
      {...props}
    />
  );
});
RadioGroup.displayName = 'RadioGroup';

export const RadioItem = forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioItemProps
>(({ className, label, error, ...props }, ref) => {
  const radio = (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={clsx(
        // Size
        'h-6 w-6',
        'shrink-0',

        // Base styles - CIRCULAR (not square like checkbox)
        'appearance-none',
        'rounded-full',
        '!border-2',
        'transition-colors duration-200',

        // Default state
        'bg-pkt-bg-default',
        !error && 'border-pkt-border-default',

        // Error state
        error && 'border-pkt-border-red',

        // Checked state
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

        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-pkt-surface-strong-dark-blue" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );

  if (label) {
    return (
      <div className="flex items-center gap-pkt-03">
        {radio}
        <label
          htmlFor={props.id}
          className={clsx(
            'text-base font-normal cursor-pointer',
            'text-pkt-text-body-default',
            props.disabled && 'cursor-not-allowed text-pkt-text-action-disabled'
          )}
        >
          {label}
        </label>
      </div>
    );
  }

  return radio;
});
RadioItem.displayName = 'RadioItem';
