import React from 'react';
import { Sak, Koe } from '../../types';
import { PktTag } from '@oslokommune/punkt-react';
import { getSakStatusLabel, getSakStatusSkin } from '../../utils/statusHelpers';
import { compareRevisions, RevisionChange } from '../../utils/compareRevisions';
import { pdfLabels } from '../../utils/pdfLabels';

interface SidePanelProps {
  sak: Sak;
  koeRevisjoner?: Koe[];
}

// Helper function to format change values with proper labels
const formatChangeValue = (field: string, value: string): string => {
  if (!value || value === 'Ikke satt') return value;

  // Check if the field is related to method/type mappings
  if (field === 'Oppgjørsmetode') {
    return pdfLabels.vederlagsmetode(value);
  }
  if (field === 'Fristtype') {
    // Fristtype er fritekst, returnerer som den er
    return value;
  }

  return value;
};

const SidePanel: React.FC<SidePanelProps> = ({ sak, koeRevisjoner = [] }) => {
  // Calculate comparison if there are at least 2 revisions
  const hasComparison = koeRevisjoner.length >= 2;
  const changes: RevisionChange[] = hasComparison
    ? compareRevisions(
        koeRevisjoner[koeRevisjoner.length - 2],
        koeRevisjoner[koeRevisjoner.length - 1]
      )
    : [];

  // Filter out changes related to "begrunnelse" fields and signature
  const filteredChanges = changes.filter(
    (change) =>
      !change.field.toLowerCase().includes('begrunnelse') &&
      !change.field.toLowerCase().includes('signatur')
  );

  return (
    <aside className="sticky top-28 space-y-4">
      <h3 className="text-base font-semibold text-ink">Nøkkelinfo</h3>
      <div className="mb-3">
        <p className="text-xs font-semibold mb-2">Saksstatus:</p>
        <PktTag skin={getSakStatusSkin(sak.status)}>
          {getSakStatusLabel(sak.status)}
        </PktTag>
      </div>
      <div className="text-xs space-y-2 p-4 rounded-lg border border-border-color" style={{ backgroundColor: '#E5FCFF' }}>
        <p><strong>Sakstittel:</strong> {sak.sakstittel || 'Ikke angitt'}</p>
        <p><strong>Sak-ID:</strong> {sak.sak_id_display || 'Ikke angitt'}</p>
        <p><strong>Prosjekt:</strong> {sak.prosjekt_navn || 'Ikke angitt'}</p>
        <p><strong>Entreprenør:</strong> {sak.entreprenor || 'Ikke angitt'}</p>
        <p><strong>Byggherre:</strong> {sak.byggherre || 'Ikke angitt'}</p>
      </div>

      {/* Comparison section */}
      {hasComparison && filteredChanges.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-ink mb-2">Endringer i siste revisjon</h3>
          <div className="text-xs space-y-2 p-4 rounded-lg border border-border-color" style={{ backgroundColor: '#E5FCFF' }}>
            {filteredChanges.map((change, idx) => (
              <div key={idx}>
                <p>
                  <strong>{change.field}:</strong>{' '}
                  <span className="text-gray-500">
                    {formatChangeValue(change.field, change.oldValue)}
                  </span>
                  {' → '}
                  <span className="text-pri font-medium">
                    {formatChangeValue(change.field, change.newValue)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

export default SidePanel;
