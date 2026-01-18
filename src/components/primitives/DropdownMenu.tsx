/**
 * DropdownMenu Component
 *
 * A dropdown menu built on Radix UI with Punkt design system styling.
 * Used for grouping secondary actions in a compact menu.
 */

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import type { ComponentPropsWithoutRef, ReactNode, ReactElement } from 'react';

/* -----------------------------------------------------------------------------
 * Root
 * -------------------------------------------------------------------------- */

export const DropdownMenu = DropdownMenuPrimitive.Root;

/* -----------------------------------------------------------------------------
 * Trigger
 * -------------------------------------------------------------------------- */

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

/* -----------------------------------------------------------------------------
 * Content
 * -------------------------------------------------------------------------- */

interface DropdownMenuContentProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> {
  children: ReactNode;
}

export function DropdownMenuContent({
  children,
  className,
  sideOffset = 4,
  align = 'end',
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={clsx(
          'z-50 min-w-[160px] overflow-hidden rounded',
          'bg-pkt-bg-card border-2 border-pkt-border-default',
          'shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2',
          'data-[side=top]:slide-in-from-bottom-2',
          className
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

/* -----------------------------------------------------------------------------
 * Item
 * -------------------------------------------------------------------------- */

interface DropdownMenuItemProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  variant?: 'default' | 'danger';
  /** Optional icon to display before the label */
  icon?: ReactElement;
}

export function DropdownMenuItem({
  className,
  variant = 'default',
  icon,
  children,
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={clsx(
        'relative flex cursor-pointer select-none items-center gap-2',
        'px-3 py-2 text-sm outline-none',
        'transition-colors',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        {
          'text-pkt-text-body-dark hover:bg-pkt-bg-subtle focus:bg-pkt-bg-subtle':
            variant === 'default',
          'text-pkt-brand-red-1000 hover:bg-pkt-brand-red-100 focus:bg-pkt-brand-red-100':
            variant === 'danger',
        },
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0 size-4">{icon}</span>}
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

/* -----------------------------------------------------------------------------
 * Separator
 * -------------------------------------------------------------------------- */

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={clsx('h-px my-1 bg-pkt-border-subtle', className)}
      {...props}
    />
  );
}

/* -----------------------------------------------------------------------------
 * Label
 * -------------------------------------------------------------------------- */

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={clsx(
        'px-3 py-2 text-xs font-semibold text-pkt-text-body-subtle',
        className
      )}
      {...props}
    />
  );
}
