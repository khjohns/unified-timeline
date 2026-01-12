import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { clsx } from 'clsx';

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Card component with Punkt design system styling
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859) for outlined variant
 * - Larger padding for better content spacing
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'none', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          // Sharp corners
          'rounded-none',
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
            'p-5': padding === 'sm',
            'p-6': padding === 'md',
            'p-10': padding === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
