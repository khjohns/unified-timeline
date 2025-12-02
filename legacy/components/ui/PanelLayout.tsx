import React from 'react';

interface PanelLayoutProps {
  children: React.ReactNode;
}

const PanelLayout: React.FC<PanelLayoutProps> = ({ children }) => {
  return (
    <div>
      {children}
    </div>
  );
};

export default PanelLayout;
