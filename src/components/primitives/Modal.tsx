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
  /**
   * Viser tittelen "rammet inn" i modalens border på mobil.
   * Gir et mer kompakt og elegant utseende på små skjermer.
   */
  framedTitle?: boolean;
  /**
   * Variant for framedTitle-stilen (kun aktiv når framedTitle=true)
   * - 'default': Bakgrunn som matcher modal (nåværende)
   * - 'pill': Tynn border rundt, transparent bakgrunn
   * - 'underline': Understrek som fortsetter fra modal-border
   * - 'inset': Tittel i en liten "notch" i toppen
   * - 'shadow': Transparent bakgrunn med text-shadow for lesbarhet
   */
  framedTitleVariant?: 'default' | 'pill' | 'underline' | 'inset' | 'shadow';
}

/**
 * Modal component with Punkt design system styling
 * - Subtle rounding (4px)
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
  framedTitle = true,
  framedTitleVariant = 'pill',
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
            // Subtle rounding (4px) and elevation
            'bg-pkt-bg-card rounded shadow-lg',
            'border border-pkt-border-default',
            'z-modal',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            // Mobile-safe max-height using dvh (dynamic viewport height) for keyboard handling
            // Use flex layout to separate header (fixed) from body (scrollable)
            'flex flex-col max-h-[85dvh]',
            {
              'w-[95vw] sm:w-[90vw] max-w-md': size === 'sm',
              'w-[95vw] sm:w-[90vw] max-w-lg': size === 'md',
              'w-[95vw] sm:w-[90vw] max-w-2xl': size === 'lg',
              'w-[95vw] sm:w-[90vw] max-w-4xl': size === 'xl',
            },
            className
          )}
        >
          {/* Framed title - positioned on border (mobile only) */}
          {framedTitle && (
            <Dialog.Title
              className={clsx(
                // Mobile: Framed title breaking the border
                'absolute left-4 top-0 -translate-y-1/2',
                'text-base font-bold text-pkt-text-body-dark',
                'max-w-[calc(100%-5rem)] truncate',
                // Desktop: Hide framed title (normal header is shown instead)
                'sm:hidden',
                // Variant-specific styling
                {
                  // Default: Solid background matching modal
                  'bg-pkt-bg-card px-2': framedTitleVariant === 'default',
                  // Pill: Thin border, solid background
                  'border border-pkt-border-default rounded px-3 py-1 bg-pkt-bg-card': framedTitleVariant === 'pill',
                  // Underline: Border-bottom continuing from modal border
                  'border-b border-pkt-border-default pb-1 bg-transparent': framedTitleVariant === 'underline',
                  // Inset: Small notch/tab effect
                  'bg-pkt-bg-card px-3 py-1 rounded-b border-x border-b border-pkt-border-default -top-px translate-y-0': framedTitleVariant === 'inset',
                  // Shadow: Transparent with text shadow for readability
                  'bg-transparent px-2 [text-shadow:_0_1px_2px_rgba(255,255,255,0.9),_0_0_4px_rgba(255,255,255,0.8)]': framedTitleVariant === 'shadow',
                }
              )}
            >
              {title}
            </Dialog.Title>
          )}

          {/* Framed close button - positioned on border (mobile only) */}
          {framedTitle && (
            <Dialog.Close
              className={clsx(
                // Mobile: Framed close button breaking the border (mirrors title position)
                'absolute right-4 top-0 -translate-y-1/2',
                'text-pkt-text-body-subtle hover:text-pkt-text-body-default',
                'focus:outline-none focus:ring-2 focus:ring-pkt-brand-purple-1000/30',
                // Desktop: Hide framed close (normal header close is shown instead)
                'sm:hidden',
                // Match the pill variant styling (solid background)
                'border border-pkt-border-default rounded p-1.5 bg-pkt-bg-card',
                'hover:bg-pkt-surface-light-beige'
              )}
              aria-label="Lukk dialog"
            >
              <Cross2Icon className="w-5 h-5" />
            </Dialog.Close>
          )}

          {/* Header - fixed, does not scroll */}
          <div className="shrink-0">
            <div
              className={clsx(
                'flex items-center justify-between',
                // When framedTitle is enabled, reduce top padding on mobile
                framedTitle
                  ? 'p-4 pt-3 sm:p-5 pb-0'
                  : 'p-4 sm:p-5 pb-0'
              )}
            >
              <div className={clsx(framedTitle && 'hidden sm:block')}>
                <Dialog.Title className="text-xl font-bold text-pkt-text-body-dark">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-3 text-lg text-pkt-text-body-subtle">
                    {description}
                  </Dialog.Description>
                )}
              </div>

              {/* Close button (desktop, or mobile without framedTitle) */}
              <Dialog.Close
                className={clsx(
                  'rounded p-2',
                  'text-pkt-text-body-subtle hover:text-pkt-text-body-default',
                  'hover:bg-pkt-surface-light-beige',
                  'focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30',
                  // Hide on mobile when framedTitle is enabled (framed close is shown instead)
                  framedTitle ? 'hidden sm:block' : ''
                )}
                aria-label="Lukk dialog"
              >
                <Cross2Icon className="w-6 h-6" />
              </Dialog.Close>
            </div>

            {/* Description shown below close button row on mobile with framed title */}
            {framedTitle && description && (
              <p className="px-4 text-base text-pkt-text-body-subtle sm:hidden">
                {description}
              </p>
            )}
          </div>

          {/* Body - scrollable area with mobile-optimized scrolling */}
          <div
            className={clsx(
              'text-sm p-4 sm:p-5',
              // Top padding: reduced on mobile when framedTitle moves title to border
              framedTitle ? 'pt-2 sm:pt-3' : 'pt-3 sm:pt-3',
              'overflow-y-auto overscroll-contain',
              // iOS smooth scrolling
              '[&]:[-webkit-overflow-scrolling:touch]'
            )}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
