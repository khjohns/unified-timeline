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
      <div className={`${maxWidthClass} mx-auto px-4 py-4 sm:px-6 sm:py-6`}>
        <div className="flex flex-col gap-1 sm:gap-4">
          {/* Row 1: Title + Actions */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg sm:text-xl font-semibold text-pkt-text-body-dark min-w-0 truncate">
              {title}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              {/* Desktop: Status + Feedback */}
              <div className="hidden sm:flex items-center gap-2">
                <ConnectionStatusIndicator />
                <div className="h-5 w-px bg-pkt-border-subtle" />
                <FeedbackButton />
              </div>
              <ThemeToggle />
              {userRole && onToggleRole && (
                <ModeToggle userRole={userRole} onToggle={onToggleRole} />
              )}
              {/* Page-specific actions - desktop only */}
              {actions && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="h-5 w-px bg-pkt-border-subtle" />
                  {actions}
                </div>
              )}
              {/* Main menu */}
              <div className="hidden sm:block h-5 w-px bg-pkt-border-subtle" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 rounded-lg bg-pkt-bg-subtle border border-pkt-grays-gray-200
                               hover:bg-pkt-bg-card hover:border-pkt-border-default
                               focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/30
                               transition-all duration-200 text-pkt-text-body-dark"
                    aria-label="Meny"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <circle cx="8" cy="3" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="8" cy="13" r="1.5" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  {/* Feedback - mobile only */}
                  <div className="sm:hidden">
                    <DropdownMenuGroup label="Tilbakemelding">
                      <div className="px-2 py-1">
                        <FeedbackButton />
                      </div>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </div>
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

          {/* Row 2: Subtitle + Status (mobile) */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-pkt-grays-gray-500">{subtitle}</p>
            <div className="sm:hidden">
              <ConnectionStatusIndicator />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
