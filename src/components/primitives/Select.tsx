import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { forwardRef, ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';

/**
 * Select component based on Radix UI Select
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859)
 * - Larger text and padding for better readability
 * - Focus state with pkt-border-focus (#e0adff)
 */

export interface SelectProps extends ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  /** Placeholder text when no value is selected */
  placeholder?: string;
  /** Whether the select has an error state */
  error?: boolean;
}

export const Select = SelectPrimitive.Root;

export const SelectGroup = SelectPrimitive.Group;

export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { error?: boolean }
>(({ className, error, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={clsx(
      // Base styles - standard select size
      'flex items-center justify-between gap-2',
      'w-full px-4 py-3 min-h-[40px]',
      'text-base font-normal',
      'bg-pkt-bg-default',
      'transition-colors duration-200',

      // Border - 2px width, sharp corners
      'border-2 rounded-none',

      // Default border color
      !error && 'border-pkt-border-default',

      // Error state
      error && 'border-pkt-border-red',

      // Focus state
      [
        'focus:outline-none',
        'focus:ring-4',
        error
          ? 'focus:ring-pkt-brand-red-400/50 focus:border-pkt-border-red'
          : 'focus:ring-pkt-brand-purple-1000/30 focus:border-pkt-border-focus',
      ],

      // Hover state
      'hover:border-pkt-border-hover',

      // Disabled state
      'disabled:cursor-not-allowed',
      'disabled:border-pkt-border-disabled',
      'disabled:bg-pkt-surface-gray',
      'disabled:text-pkt-text-action-disabled',

      // Data state
      'data-[placeholder]:text-pkt-text-placeholder',

      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon className="h-5 w-5 shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectScrollUpButton = forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={clsx(
      'flex cursor-default items-center justify-center py-1',
      'bg-pkt-bg-default',
      className
    )}
    {...props}
  >
    <ChevronUpIcon className="h-5 w-5" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

export const SelectScrollDownButton = forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={clsx(
      'flex cursor-default items-center justify-center py-1',
      'bg-pkt-bg-default',
      className
    )}
    {...props}
  >
    <ChevronDownIcon className="h-5 w-5" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

export const SelectContent = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={clsx(
        'relative z-dropdown',
        'max-h-96 min-w-[8rem] overflow-hidden',
        'bg-pkt-bg-default',
        'border-2 border-pkt-border-default rounded-none',
        'shadow-lg',
        // Animations
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2',
        'data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2',
        'data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={clsx(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectLabel = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={clsx(
      'px-3 py-2',
      'text-sm font-semibold',
      'text-pkt-text-body-default',
      className
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export const SelectItem = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={clsx(
      'relative flex w-full cursor-default select-none items-center',
      'px-4 py-3',
      'text-base font-normal',
      'outline-none',
      'transition-colors duration-150',

      // Hover/focus state
      'focus:bg-pkt-surface-light-blue',
      'data-[highlighted]:bg-pkt-surface-light-blue',

      // Disabled state
      'data-[disabled]:pointer-events-none',
      'data-[disabled]:text-pkt-text-action-disabled',

      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export const SelectSeparator = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={clsx('my-1 h-px bg-pkt-border-subtle', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;
