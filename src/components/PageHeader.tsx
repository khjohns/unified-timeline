/**
 * PageHeader Component
 *
 * Shared header component for case pages.
 * Provides consistent styling and layout across CasePage and ForseringPage.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  FileTextIcon,
  BarChartIcon,
  ExclamationTriangleIcon,
  Link2Icon,
} from '@radix-ui/react-icons';
import { ThemeToggle } from './ThemeToggle';
import { ModeToggle } from './ModeToggle';
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
  /** Additional actions (e.g., PDF download button) */
  actions?: ReactNode;
  /** Max width variant: 'narrow' (3xl) for CasePage, 'wide' (7xl) for ForseringPage */
  maxWidth?: 'narrow' | 'medium' | 'wide';
}

export function PageHeader({
  title,
  subtitle,
  userRole,
  onToggleRole,
  actions,
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
            {/* Page-specific actions */}
            {actions}

            {/* Main menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" aria-label="Meny">
                  ⋮
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {/* Navigation */}
                <DropdownMenuGroup label="Sider">
                  <DropdownMenuItem icon={<FileTextIcon />} asChild>
                    <Link to="/saker">Saksoversikt</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem icon={<BarChartIcon />} asChild>
                    <Link to="/analyse">Analyse</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem icon={<ExclamationTriangleIcon />} asChild>
                    <Link to="/fravik-analyse">Fravikanalyse</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem icon={<Link2Icon />} asChild>
                    <Link to="/integrasjoner">Integrasjoner</Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                {/* Settings */}
                <DropdownMenuGroup label="Innstillinger">
                  <div className="px-3 py-2">
                    <ThemeToggle />
                  </div>
                  {userRole && onToggleRole && (
                    <div className="px-3 py-2">
                      <ModeToggle userRole={userRole} onToggle={onToggleRole} />
                    </div>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
