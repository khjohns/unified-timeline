/**
 * PageHeader Component
 *
 * Shared header component for case pages.
 * Provides consistent styling and layout across CasePage and ForseringPage.
 */

import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { ModeToggle } from './ModeToggle';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  userRole: 'TE' | 'BH';
  onToggleRole: (role: 'TE' | 'BH') => void;
  /** Additional actions (e.g., PDF download button) */
  actions?: ReactNode;
  /** Max width variant: 'narrow' (3xl) for CasePage, 'wide' (7xl) for ForseringPage */
  maxWidth?: 'narrow' | 'wide';
}

export function PageHeader({
  title,
  subtitle,
  userRole,
  onToggleRole,
  actions,
  maxWidth = 'narrow',
}: PageHeaderProps) {
  const maxWidthClass = maxWidth === 'narrow' ? 'max-w-3xl' : 'max-w-7xl';

  return (
    <header className="bg-pkt-bg-card border-b border-pkt-grays-gray-200">
      <div className={`${maxWidthClass} mx-auto px-4 py-4 sm:px-8 sm:py-6`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Title and subtitle */}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-pkt-text-body-dark">
              {title}
            </h1>
            <p className="text-sm text-pkt-grays-gray-500 mt-1">{subtitle}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Toggle group */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <ModeToggle userRole={userRole} onToggle={onToggleRole} />
            </div>

            {/* Additional actions with separator */}
            {actions && (
              <>
                <div className="hidden sm:block h-6 w-px bg-pkt-border-subtle" />
                {actions}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
