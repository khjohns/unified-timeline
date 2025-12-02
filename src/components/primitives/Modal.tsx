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
            'bg-white rounded-pkt-lg shadow-xl',
            'p-pkt-06',
            'z-modal',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'max-h-[90vh] overflow-y-auto',
            {
              'w-[90vw] max-w-md': size === 'sm',
              'w-[90vw] max-w-lg': size === 'md',
              'w-[90vw] max-w-2xl': size === 'lg',
              'w-[90vw] max-w-4xl': size === 'xl',
            },
            className
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-pkt-04">
            <div>
              <Dialog.Title className="text-heading-lg font-bold text-oslo-blue">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-pkt-02 text-body-md text-gray-600">
                  {description}
                </Dialog.Description>
              )}
            </div>

            {/* Close button */}
            <Dialog.Close
              className={clsx(
                'rounded-pkt-sm p-pkt-02',
                'text-gray-500 hover:text-gray-700',
                'hover:bg-oslo-beige-100',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-oslo-blue'
              )}
              aria-label="Lukk dialog"
            >
              <Cross2Icon className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
