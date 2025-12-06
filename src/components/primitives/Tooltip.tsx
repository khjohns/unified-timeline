import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { ReactNode, useState } from 'react';
import { clsx } from 'clsx';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

/**
 * Tooltip component with improved click behavior:
 * - Opens on hover (with delay)
 * - Toggles on click (stays open until clicked again or focus lost)
 * - Better for keyboard and touch users
 * - Closes when clicking outside or pressing Escape
 * - Mobile-safe with collision detection and viewport constraints
 */
export function Tooltip({ content, children, side = 'top', delayDuration = 200 }: TooltipProps) {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen(!open);
  };

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild onClick={handleClick}>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            className={clsx(
              'z-tooltip',
              'px-3 py-2',
              'bg-gray-900 text-white text-sm',
              'rounded-none shadow-lg',
              // Viewport-safe max-width: smaller on mobile, larger on desktop
              'max-w-[calc(100vw-2rem)] sm:max-w-xs',
              'data-[state=delayed-open]:animate-in',
              'data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0',
              'data-[state=delayed-open]:fade-in-0',
              'data-[side=bottom]:slide-in-from-top-2',
              'data-[side=left]:slide-in-from-right-2',
              'data-[side=right]:slide-in-from-left-2',
              'data-[side=top]:slide-in-from-bottom-2'
            )}
            sideOffset={5}
            // Collision handling for mobile safety
            collisionPadding={12}
            avoidCollisions
            onPointerDownOutside={() => setOpen(false)}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-gray-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
