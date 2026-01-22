import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef, ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';

export interface LabelProps extends ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /** Whether the field is optional (shows discrete tag) */
  optional?: boolean;
  /** @deprecated No longer displays asterisk - use validation instead. Kept for backwards compatibility. */
  required?: boolean;
}

/**
 * Label component based on Radix UI Label
 * - Larger text for better readability
 * - Optional indicator with discrete tag
 * - Punkt design system styling
 * - Supports light and dark themes
 */
export const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, optional, required: _required, children, ...props }, ref) => {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={clsx(
        'block text-sm font-medium',
        'text-pkt-text-body-default',
        'mb-2',
        className
      )}
      {...props}
    >
      {children}
      {optional && (
        <span
          className="ml-2 inline-flex items-center px-1.5 py-0.5 text-xs font-normal rounded bg-pkt-bg-subtle text-pkt-text-body-subtle border border-pkt-border-subtle"
          aria-label="valgfritt felt"
        >
          valgfritt
        </span>
      )}
    </LabelPrimitive.Root>
  );
});

Label.displayName = 'Label';
