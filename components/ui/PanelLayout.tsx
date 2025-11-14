import React from 'react';

interface PanelLayoutProps {
  children: React.ReactNode;
}

const PanelLayout: React.FC<PanelLayoutProps> = ({ children }) => {
  return (
    <div className="bg-card-bg rounded-lg p-8 shadow-sm">
      {children}
    </div>
  );
};

export default PanelLayout;
