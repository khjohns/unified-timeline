/**
 * PageHeader Component
 *
 * Shared header component for case pages.
 * Provides consistent styling and layout across CasePage and ForseringPage.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { ModeToggle } from './ModeToggle';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { FeedbackButton } from './FeedbackButton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  Button,
} from './primitives';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  /** User role for mode toggle (optional for overview pages) */
  userRole?: 'TE' | 'BH';
  /** Callback for role toggle (optional for overview pages) */
  onToggleRole?: (role: 'TE' | 'BH') => void;
  /** Additional actions (e.g., PDF download button) - shown outside menu */
  actions?: ReactNode;
  /** Actions to show inside the dropdown menu */
  menuActions?: ReactNode;
  /** Max width variant: 'narrow' (3xl) for CasePage, 'wide' (7xl) for ForseringPage */
  maxWidth?: 'narrow' | 'medium' | 'wide';
}

export function PageHeader({
  title,
  subtitle,
  userRole,
  onToggleRole,
  actions,
  menuActions,
  maxWidth = 'narrow',
}: PageHeaderProps) {
  const maxWidthClass = {
    narrow: 'max-w-3xl',
    medium: 'max-w-5xl',
    wide: 'max-w-7xl',
  }[maxWidth];

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
            {/* Status and toggle group */}
            <div className="flex items-center gap-2">
              <ConnectionStatusIndicator />
              <div className="h-5 w-px bg-pkt-border-subtle" />
              <FeedbackButton />
              <ThemeToggle />
              {userRole && onToggleRole && (
                <ModeToggle userRole={userRole} onToggle={onToggleRole} />
              )}
            </div>

            {/* Page-specific actions */}
            {actions && (
              <>
                <div className="hidden sm:block h-5 w-px bg-pkt-border-subtle" />
                {actions}
              </>
            )}

            {/* Main menu */}
            <div className="hidden sm:block h-5 w-px bg-pkt-border-subtle" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" aria-label="Meny">
                  ⋮
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {/* Page-specific menu actions */}
                {menuActions && (
                  <>
                    <DropdownMenuGroup label="Handlinger">
                      {menuActions}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Navigation */}
                <DropdownMenuGroup label="Sider">
                  <DropdownMenuItem asChild>
                    <Link to="/saker">Saksoversikt</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/fravik">Fravik-søknader</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/analyse">Analyse</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/fravik-analyse">Fravikanalyse</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/integrasjoner">Integrasjoner</Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
