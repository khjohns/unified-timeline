import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { clsx } from 'clsx';

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'md' | 'lg';
}

/**
 * Card component with Punkt design system styling
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859) for outlined variant
 * - Larger padding for better content spacing
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className, children, ...props }, ref) => {
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

            // Outlined: white background with border-default
            'bg-pkt-bg-card border-2 border-pkt-border-default': variant === 'outlined',
          },
          {
            // Increased padding for better spacing
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
