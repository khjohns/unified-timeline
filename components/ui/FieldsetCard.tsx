
import React from 'react';

interface FieldsetCardProps {
  legend: string;
  children: React.ReactNode;
  className?: string;
  isBhPanel?: boolean;
}

const FieldsetCard: React.FC<FieldsetCardProps> = ({ legend, children, className = '', isBhPanel = false }) => {
  const bhClasses = isBhPanel ? 'bh-fieldset border-border-color' : 'border-border-color';
  return (
    <fieldset className={`bg-card-bg border rounded-lg p-6 shadow-sm transition-all duration-300 ${bhClasses} ${className}`}>
      <legend className="text-lg font-semibold text-pri px-2">{legend}</legend>
      <div className="mt-4">
        {children}
      </div>
    </fieldset>
  );
};

export default FieldsetCard;
