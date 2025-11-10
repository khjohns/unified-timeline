
import React from 'react';

interface PanelProps {
  id: string;
  isActive: boolean;
  children: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({ id, isActive, children }) => {
  if (!isActive) return null;

  return (
    <section id={id} className="panel border border-border-color border-t-0 bg-white rounded-b-lg rounded-tr-lg p-4 sm:p-6" role="tabpanel">
      {children}
    </section>
  );
};

export default Panel;
