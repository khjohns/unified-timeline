/**
 * Layout Component
 *
 * Wraps page content with consistent header (project selector) and footer.
 * Ensures footer is always at the bottom of the viewport.
 */

import { ReactNode } from 'react';
import { Footer } from './Footer';
import { ProjectSelector } from './ProjectSelector';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-end px-4 py-2">
        <ProjectSelector />
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
