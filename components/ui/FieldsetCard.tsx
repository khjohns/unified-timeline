import React from 'react';

interface FieldsetCardProps {
  legend: string;
  children: React.ReactNode;
  className?: string;
}

const FieldsetCard: React.FC<FieldsetCardProps> = ({ legend, children, className = '' }) => {
  return (
    <div className={`mb-10 ${className}`}> {/* Økt margin i bunn */}
      
      <h2 className="text-lg font-semibold text-pri mb-6">
        {legend}
      </h2>

      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
};

export default FieldsetCard;
