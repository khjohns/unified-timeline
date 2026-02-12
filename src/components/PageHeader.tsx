/**
 * PageHeader Component
 *
 * Shared header component for case pages.
 * Provides consistent styling and layout across CasePage and ForseringPage.
 *
 * Mobile layout (2 rows):
 * - Row 1: Title + Status + Menu
 * - Row 2: Subtitle + Theme/Mode toggles
 */

import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  HomeIcon,
  FileTextIcon,
  BarChartIcon,
  MixerHorizontalIcon,
  ChatBubbleIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
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
  const [menuOpen, setMenuOpen] = useState(false);

  const maxWidthClass = {
    narrow: 'max-w-3xl',
    medium: 'max-w-5xl',
    wide: 'max-w-7xl',
  }[maxWidth];

  return (
    <header className="bg-pkt-bg-card border-b border-pkt-grays-gray-200">
      <div className={`${maxWidthClass} mx-auto px-4 py-3 sm:px-6 sm:py-3`}>
        <div className="flex flex-col gap-0.5 sm:gap-0">
          {/* Row 1: Title (+ Subtitle on desktop) + Status + Menu */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-pkt-text-body-dark truncate">
                {title}
              </h1>
              <span className="hidden sm:inline text-pkt-grays-gray-400">·</span>
              <p className="hidden sm:block text-sm text-pkt-grays-gray-500 truncate">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile: Status only */}
              <div className="sm:hidden">
                <ConnectionStatusIndicator />
              </div>
              {/* Desktop: Status + Feedback + Toggles + Actions */}
              <div className="hidden sm:flex items-center gap-2">
                <ConnectionStatusIndicator />
                <div className="h-5 w-px bg-pkt-border-subtle" />
                <FeedbackButton />
                <ThemeToggle />
                {userRole && onToggleRole && (
                  <ModeToggle userRole={userRole} onToggle={onToggleRole} />
                )}
                {actions && (
                  <>
                    <div className="h-5 w-px bg-pkt-border-subtle" />
                    {actions}
                  </>
                )}
                <div className="h-5 w-px bg-pkt-border-subtle" />
              </div>
              {/* Menu */}
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1.5 rounded-md text-pkt-text-body-subtle
                               hover:text-pkt-text-body-default hover:bg-pkt-bg-subtle
                               focus:outline-none focus:ring-2 focus:ring-pkt-brand-warm-blue-1000/30
                               transition-colors duration-200"
                    aria-label="Meny"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <circle cx="8" cy="3" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="8" cy="13" r="1.5" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  {/* Feedback - mobile only */}
                  <div className="sm:hidden">
                    <DropdownMenuItem
                      icon={<ChatBubbleIcon />}
                      onSelect={() => {
                        setMenuOpen(false);
                        // Trigger feedback modal via custom event
                        window.dispatchEvent(new CustomEvent('open-feedback-modal'));
                      }}
                    >
                      Gi tilbakemelding
                    </DropdownMenuItem>
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
                  <DropdownMenuGroup label="Navigasjon">
                    <DropdownMenuItem icon={<HomeIcon />} asChild>
                      <Link to="/saker">Saksoversikt</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem icon={<FileTextIcon />} asChild>
                      <Link to="/fravik">Fravik-søknader</Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup label="Analyse">
                    <DropdownMenuItem icon={<BarChartIcon />} asChild>
                      <Link to="/analyse">Saksanalyse</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem icon={<BarChartIcon />} asChild>
                      <Link to="/fravik-analyse">Fravikanalyse</Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup label="Innstillinger">
                    <DropdownMenuItem icon={<PersonIcon />} asChild>
                      <Link to="/medlemmer">Prosjektmedlemmer</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem icon={<MixerHorizontalIcon />} asChild>
                      <Link to="/integrasjoner">Integrasjoner</Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Row 2: Subtitle + Toggles (mobile only) */}
          <div className="flex sm:hidden items-center justify-between gap-2">
            <p className="text-sm text-pkt-grays-gray-500">{subtitle}</p>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              {userRole && onToggleRole && (
                <ModeToggle userRole={userRole} onToggle={onToggleRole} />
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
