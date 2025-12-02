import React from 'react';
import { FormDataModel } from '../../types';
import SidePanel from '../ui/SidePanel';

interface AppLayoutProps {
  children: React.ReactNode;
  sidePanel?: {
    sak: FormDataModel['sak'];
    koeRevisjoner: FormDataModel['koe_revisjoner'];
  };
}

/**
 * Main application layout component
 *
 * Provides the main 2/3 + 1/3 grid layout:
 * - Left column (2/3): Main content (tabs, panels, bottom bar)
 * - Right column (1/3): Side panel with case information
 *
 * Layout is responsive:
 * - Desktop: 2-column grid
 * - Mobile: Single column (side panel hidden)
 *
 * @param children - Main content to render in left column
 * @param sidePanel - Optional side panel data (sak and koeRevisjoner)
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children, sidePanel }) => {
  return (
    <main className="pt-24 pb-8 sm:pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 lg:grid lg:grid-cols-3 lg:gap-12">
        {/* Hovedkolonne (2/3) - Main content */}
        <div className="lg:col-span-2 space-y-8">
          {children}
        </div>

        {/* Sidekolonne (1/3) - Case information (desktop only) */}
        {sidePanel && (
          <div className="hidden lg:block lg:col-span-1">
            <SidePanel
              sak={sidePanel.sak}
              koeRevisjoner={sidePanel.koeRevisjoner}
            />
          </div>
        )}
      </div>
    </main>
  );
};

export default AppLayout;
