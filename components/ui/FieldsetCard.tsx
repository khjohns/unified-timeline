
import React from 'react';

interface FieldsetCardProps {
  legend: string;
  children: React.ReactNode;
  className?: string;
}

const FieldsetCard: React.FC<FieldsetCardProps> = ({ legend, children, className = '' }) => {
  return (
    <div className={`mb-8 ${className}`}>
      <h3 className="text-lg font-semibold text-ink border-b border-border-color pb-2 mb-5">
        {legend}
      </h3>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
};

export default FieldsetCard;
