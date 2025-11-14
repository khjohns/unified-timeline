import React from 'react';

interface PanelLayoutProps {
  children: React.ReactNode;
  sidePanel?: React.ReactNode;
}

const PanelLayout: React.FC<PanelLayoutProps> = ({ children, sidePanel }) => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="lg:grid lg:grid-cols-3 lg:gap-12">
        {/* Main content column (2/3) */}
        <div className="lg:col-span-2 bg-card-bg rounded-lg p-8 shadow-sm">
          {children}
        </div>

        {/* Side panel column (1/3) */}
        {sidePanel && sidePanel}
      </div>
    </div>
  );
};

export default PanelLayout;
