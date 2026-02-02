import { ComponentPropsWithoutRef, Ref } from 'react';
import { clsx } from 'clsx';

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Ref to the card element */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Card component with Punkt design system styling
 * - Subtle rounding (4px)
 * - border-pkt-border-default (#2a2859) for outlined variant
 * - Larger padding for better content spacing
 */
export function Card({ variant = 'default', padding = 'none', className, children, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={clsx(
        // Subtle rounding (4px)
        'rounded',
        {
          // Default: white background
          'bg-pkt-bg-card': variant === 'default',

          // Elevated: white background with shadow
          'bg-pkt-bg-card shadow-lg': variant === 'elevated',

          // Outlined: white background with subtle border (1px for refined look)
          'bg-pkt-bg-card border border-pkt-border-subtle': variant === 'outlined',
        },
        {
          // Padding options - default is 'none' for flexible layouts
          'p-0': padding === 'none',
          'p-3 sm:p-4': padding === 'sm',
          'p-4 sm:p-6': padding === 'md',
          'p-6 sm:p-10': padding === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
