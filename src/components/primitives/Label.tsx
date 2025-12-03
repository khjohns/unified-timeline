import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef, ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';

export interface LabelProps extends ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /** Whether the field is required (shows red asterisk) */
  required?: boolean;
}

/**
 * Label component based on Radix UI Label
 * - Larger text for better readability
 * - Required indicator with red asterisk
 * - Punkt design system styling
 */
export const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, required, children, ...props }, ref) => {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={clsx(
        'block text-base font-medium',
        'text-pkt-text-body-default',
        'mb-pkt-02',
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-pkt-border-red" aria-label="påkrevd">
          *
        </span>
      )}
    </LabelPrimitive.Root>
  );
});

Label.displayName = 'Label';
