import React from 'react';

interface FieldsetCardProps {
  legend: string;
  children: React.ReactNode;
  className?: string;
}

const FieldsetCard: React.FC<FieldsetCardProps> = ({ legend, children, className = '' }) => {
  return (
    <div className={`mb-10 ${className}`}> {/* Økt margin i bunn */}
      
      {/* ENDRET HER:
          - Bruker <h2> for bedre hierarki
          - Økt tekststørrelse til 'text-2xl' (Tailwind)
          - Bruker 'font-bold'
          - Fjernet 'border-b', 'pb-2' og endret 'mb-5' til 'mb-6'
          - La til 'text-ink-dim' for en mørk, men ikke helt sort farge
      */}
      <h2 className="text-2xl font-bold text-ink-dim mb-6">
        {legend}
      </h2>

      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
};

export default FieldsetCard;
