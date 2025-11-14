import React from 'react';

interface FieldsetCardProps {
  legend: string;
  children: React.ReactNode;
  className?: string;
}

// NY KODE (basert på "Fravik"-prosjektets stil)
const FieldsetCard: React.FC<FieldsetCardProps> = ({ legend, children, className = '' }) => {
  return (
    <fieldset className={`border border-border-color rounded-lg p-6 mb-10 ${className}`}>
      {/* Merk: bg-card-bg (hvit bakgrunn) er fjernet her, 
        fordi PanelLayout.tsx allerede har denne bakgrunnen.
        Dette gir en ramme internt i panelet.
      */}
      <legend className="text-lg font-semibold text-pri px-2">
        {legend}
      </legend>
      <div className="mt-4 space-y-6">
        {children}
      </div>
    </fieldset>
  );
};

export default FieldsetCard;
