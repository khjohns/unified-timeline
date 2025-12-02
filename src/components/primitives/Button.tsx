import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          // Base styles
          'inline-flex items-center justify-center rounded-pkt-md',
          'font-medium transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Variant styles
          {
            'bg-oslo-blue text-white hover:bg-oslo-blue-700 focus-visible:outline-oslo-blue':
              variant === 'primary',
            'bg-oslo-beige text-oslo-blue hover:bg-oslo-beige-300 focus-visible:outline-oslo-blue':
              variant === 'secondary',
            'bg-transparent hover:bg-oslo-beige-100 focus-visible:outline-oslo-blue':
              variant === 'ghost',
            'bg-error text-white hover:bg-error-500 focus-visible:outline-error':
              variant === 'danger',
          },

          // Size styles
          {
            'px-pkt-03 py-pkt-02 text-sm': size === 'sm',
            'px-pkt-04 py-pkt-03 text-base': size === 'md',
            'px-pkt-06 py-pkt-04 text-lg': size === 'lg',
          },

          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
