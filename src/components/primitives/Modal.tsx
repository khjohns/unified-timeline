import * as Dialog from '@radix-ui/react-dialog';
import { Cross2Icon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Modal component with Punkt design system styling
 * - Sharp corners (radius: 0)
 * - border-pkt-border-default (#2a2859)
 * - Larger padding and text for better readability
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          className={clsx(
            'fixed inset-0 bg-black/50 backdrop-blur-sm',
            'z-modal-backdrop',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Content */}
        <Dialog.Content
          className={clsx(
            'fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]',
            // Sharp corners and border
            'bg-pkt-bg-card rounded-none shadow-xl',
            'border-2 border-pkt-border-default',
            // Responsive padding - smaller on mobile for more content space
            'p-4 sm:p-6 md:p-8',
            'z-modal',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            // Mobile-safe max-height using dvh (dynamic viewport height) for keyboard handling
            'max-h-[85dvh] overflow-y-auto',
            {
              'w-[95vw] sm:w-[90vw] max-w-md': size === 'sm',
              'w-[95vw] sm:w-[90vw] max-w-lg': size === 'md',
              'w-[95vw] sm:w-[90vw] max-w-2xl': size === 'lg',
              'w-[95vw] sm:w-[90vw] max-w-4xl': size === 'xl',
            },
            className
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <Dialog.Title className="text-2xl font-bold text-pkt-text-body-dark">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-3 text-lg text-pkt-grays-gray-600">
                  {description}
                </Dialog.Description>
              )}
            </div>

            {/* Close button - sharp corners */}
            <Dialog.Close
              className={clsx(
                'rounded-none p-2',
                'text-pkt-grays-gray-500 hover:text-pkt-grays-gray-700',
                'hover:bg-pkt-surface-light-beige',
                'focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30'
              )}
              aria-label="Lukk dialog"
            >
              <Cross2Icon className="w-6 h-6" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="text-base">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
