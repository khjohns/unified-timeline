import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef, ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';

export interface SwitchProps extends ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  /** Label text to display next to the switch */
  label?: string;
  /** Description text to display below the label */
  description?: string;
}

/**
 * Switch component based on Radix UI Switch
 * iOS-style toggle for binary on/off states
 */
export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, label, description, ...props }, ref) => {
  const switchElement = (
    <SwitchPrimitive.Root
      ref={ref}
      className={clsx(
        // Size - 44x24px
        'w-11 h-6',
        'shrink-0',
        'rounded-full',
        'relative',
        'transition-colors duration-200',

        // Default (off) state
        'bg-pkt-grays-gray-300',

        // Checked (on) state
        'data-[state=checked]:bg-pkt-surface-strong-dark-blue',

        // Focus state
        'focus:outline-none',
        'focus:ring-4',
        'focus:ring-pkt-brand-purple-1000/30',

        // Disabled state
        'disabled:cursor-not-allowed',
        'disabled:opacity-50',

        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={clsx(
          // Size
          'block w-5 h-5',
          'rounded-full',
          'bg-white',
          'shadow-sm',
          'transition-transform duration-200',

          // Position
          'translate-x-0.5',
          'data-[state=checked]:translate-x-[22px]'
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (label) {
    return (
      <div className="flex items-start gap-3">
        <div className="mt-px">{switchElement}</div>
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

  return switchElement;
});

Switch.displayName = 'Switch';
