import React, { useState } from 'react';
import { Modal, Button, RadioGroup, TextArea, Alert } from '@your-design-system';

export const UpdateResponseModal = ({ lastResponseEvent, currentKravState, onSubmit, onClose }) => {
  const [nyttSvar, setNyttSvar] = useState('');
  const [kommentar, setKommentar] = useState('');

  // Sjekk om forrige svar var en midlertidig stans
  const varTilbakeholdelse = lastResponseEvent.svar === 'HOLD_TILBAKE';
  const harNaaOverslag = currentKravState.regningsarbeid?.kostnadsOverslag > 0;

  const getOptions = () => {
    // Hvis vi kommer fra en tilbakeholdelse, er det naturlig å godkjenne nå
    if (varTilbakeholdelse) {
      return [
        { 
          value: 'OPPHEV_TILBAKEHOLD', 
          label: 'Opphev tilbakeholdelse (Ta overslag til etterretning)',
          description: 'TE har levert overslag. Betaling kan gjenopptas iht. § 30.2.'
        },
        { 
          value: 'AVVIST_BELOP', 
          label: 'Avvis overslaget / Bestrid timene',
          description: 'Selv med overslag mener du kostnadene er urimelige.' 
        }
      ];
    }

    // Generell omgjøring (f.eks. fra Avvist til Godkjent)
    return [
      { value: 'GODKJENT', label: 'Endre til: Godkjent' },
      { value: 'DELVIS_GODKJENT', label: 'Endre til: Delvis godkjent (Forlik/Enighet)' }
    ];
  };

  const handleSubmit = () => {
    onSubmit({
      type: 'SVAR_PA_VEDERLAG_OPPDATERT',
      payload: {
        originalSvarId: lastResponseEvent.id,
        nyttSvar,
        kommentar,
        datoEndret: new Date()
      }
    });
  };

  return (
    <Modal title="Oppdater svar på vederlag" size="md">
      <div className="space-y-6">
        
        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-sm">
          Nåværende status: <strong>{lastResponseEvent.svar_label}</strong>
          <br/>
          Dato: {new Date(lastResponseEvent.dato).toLocaleDateString()}
        </div>

        {varTilbakeholdelse && harNaaOverslag && (
          <Alert variant="success">
            Systemet registrerer at Entreprenøren nå har levert kostnadsoverslag. 
            Det er derfor korrekt prosedyre å oppheve tilbakeholdelsen.
          </Alert>
        )}

        <RadioGroup 
          label="Ny avgjørelse"
          value={nyttSvar}
          onChange={setNyttSvar}
          options={getOptions()}
        />

        <TextArea 
          label="Begrunnelse for endring" 
          value={kommentar}
          onChange={e => setKommentar(e.target.value)}
          placeholder="F.eks. 'Overslag mottatt', 'Enighet oppnådd i møte', 'Ny vurdering'..."
          required
        />

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button variant="primary" onClick={handleSubmit}>Lagre endring</Button>
      </Modal.Footer>
    </Modal>
  );
};