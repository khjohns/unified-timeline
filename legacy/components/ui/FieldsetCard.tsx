import React from 'react';

interface FieldsetCardProps {
  legend: string;
  children: React.ReactNode;
  className?: string;
}

// NY KODE (basert på "Fravik"-prosjektets stil)
const FieldsetCard: React.FC<FieldsetCardProps> = ({ legend, children, className = '' }) => {
  return (
    <fieldset className={`bg-card-bg border border-border-color rounded-lg p-6 mb-10 ${className}`}>
      <legend className="text-base font-semibold text-pri px-2">
        {legend}
      </legend>
      <div className="mt-4 space-y-6">
        {children}
      </div>
    </fieldset>
  );
};

export default FieldsetCard;
