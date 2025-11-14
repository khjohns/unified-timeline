import React from 'react';
import { Sak } from '../../types';

interface SidePanelProps {
  sak: Sak;
}

const SidePanel: React.FC<SidePanelProps> = ({ sak }) => {
  return (
    <aside className="h-fit">
      <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto space-y-4">
        <h3 className="text-lg font-semibold text-ink">Nøkkelinfo</h3>
        <div className="text-sm space-y-2 p-4 rounded-lg border border-border-color" style={{ backgroundColor: '#E5FCFF' }}>
          <p><strong>Sakstittel:</strong> {sak.sakstittel || 'Ikke angitt'}</p>
          <p><strong>Sak-ID:</strong> {sak.sak_id_display || 'Ikke angitt'}</p>
          <p><strong>Prosjekt:</strong> {sak.prosjekt_navn || 'Ikke angitt'}</p>
          <p><strong>Entreprenør:</strong> {sak.entreprenor || 'Ikke angitt'}</p>
          <p><strong>Byggherre:</strong> {sak.byggherre || 'Ikke angitt'}</p>
        </div>
      </div>
    </aside>
  );
};

export default SidePanel;
