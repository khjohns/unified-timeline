import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { clsx } from 'clsx';

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-pkt-md',
          {
            'bg-white': variant === 'default',
            'bg-white shadow-lg': variant === 'elevated',
            'bg-white border-2 border-oslo-beige-300': variant === 'outlined',
          },
          {
            'p-pkt-04': padding === 'sm',
            'p-pkt-06': padding === 'md',
            'p-pkt-08': padding === 'lg',
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
