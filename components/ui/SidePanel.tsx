import React from 'react';
import { Sak } from '../../types';

interface SidePanelProps {
  sak: Sak;
}

const SidePanel: React.FC<SidePanelProps> = ({ sak }) => {
  return (
    <aside className="sticky top-28 space-y-4">
      <h3 className="text-base font-semibold text-ink">Nøkkelinfo</h3>
      <div className="text-xs space-y-2 p-4 rounded-lg border border-border-color" style={{ backgroundColor: '#E5FCFF' }}>
        <p><strong>Sakstittel:</strong> {sak.sakstittel || 'Ikke angitt'}</p>
        <p><strong>Sak-ID:</strong> {sak.sak_id_display || 'Ikke angitt'}</p>
        <p><strong>Prosjekt:</strong> {sak.prosjekt_navn || 'Ikke angitt'}</p>
        <p><strong>Entreprenør:</strong> {sak.entreprenor || 'Ikke angitt'}</p>
        <p><strong>Byggherre:</strong> {sak.byggherre || 'Ikke angitt'}</p>
      </div>
    </aside>
  );
};

export default SidePanel;
