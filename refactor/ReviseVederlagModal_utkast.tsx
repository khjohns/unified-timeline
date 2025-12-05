import React, { useState } from 'react';
import { Modal, Button, CurrencyInput, TextArea, Alert, Badge } from '@your-design-system';

export const ReviseVederlagModal = ({ lastVederlagEvent, onSubmit, onClose }) => {
  // Vi baserer oss på forrige state
  const [nyttBelop, setNyttBelop] = useState(lastVederlagEvent.belopDirekte);
  const [nyttOverslag, setNyttOverslag] = useState(lastVederlagEvent.regningsarbeid?.kostnadsOverslag);
  const [begrunnelse, setBegrunnelse] = useState('');
  
  const metode = lastVederlagEvent.metode;

  // Logikk: Er dette en økning av overslag? (§ 30.2 annet ledd)
  const erOverslagsOkning = metode === 'REGNINGSARBEID' && 
    (nyttOverslag > (lastVederlagEvent.regningsarbeid?.kostnadsOverslag || 0));

  const handleSubmit = () => {
    onSubmit({
      type: 'EVENT_VEDERLAG_REVIDERT',
      payload: {
        originalEventId: lastVederlagEvent.id,
        nyttBelop: metode !== 'REGNINGSARBEID' ? nyttBelop : null,
        nyttKostnadsOverslag: metode === 'REGNINGSARBEID' ? nyttOverslag : null,
        begrunnelse, // "Korrigering", "Etter forhandling", "Varsel om overskridelse"
        datoRevidert: new Date()
      }
    });
  };

  return (
    <Modal title="Revider vederlagskrav" size="md">
      <div className="space-y-6">
        
        <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
          Endrer krav knyttet til: <strong>{lastVederlagEvent.kravTittel}</strong>
        </div>

        {/* Felt for Beløp (Fastpris/Enhetspris) */}
        {metode !== 'REGNINGSARBEID' && (
          <div className="grid grid-cols-2 gap-4 items-end">
            <CurrencyInput 
              label="Opprinnelig beløp" 
              value={lastVederlagEvent.belopDirekte} 
              disabled 
            />
            <CurrencyInput 
              label="Nytt beløp" 
              value={nyttBelop} 
              onChange={setNyttBelop} 
              autoFocus
            />
          </div>
        )}

        {/* Felt for Kostnadsoverslag (Regningsarbeid) */}
        {metode === 'REGNINGSARBEID' && (
          <div>
            <div className="grid grid-cols-2 gap-4 items-end">
              <CurrencyInput 
                label="Gjeldende overslag" 
                value={lastVederlagEvent.regningsarbeid?.kostnadsOverslag} 
                disabled 
              />
              <CurrencyInput 
                label="Nytt kostnadsoverslag" 
                value={nyttOverslag} 
                onChange={setNyttOverslag} 
                autoFocus
              />
            </div>
            
            {/* Kritisk varsel for § 30.2 */}
            {erOverslagsOkning && (
              <Alert variant="danger" className="mt-3">
                <strong>Varslingsplikt (§ 30.2):</strong><br/>
                Du øker kostnadsoverslaget. Du <strong>må</strong> begrunne hvorfor det er "grunn til å anta" 
                at det gamle sprekker. Uten varsel "uten ugrunnet opphold" kan du bli bundet av det gamle overslaget.
              </Alert>
            )}
          </div>
        )}

        <TextArea 
          label="Årsak til endring" 
          placeholder="F.eks. 'Etter avtale i byggemøte X', 'Korrigert mengde', 'Varsel om sprekk'..."
          value={begrunnelse}
          onChange={e => setBegrunnelse(e.target.value)}
          required
        />

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button variant="primary" onClick={handleSubmit}>Oppdater Krav</Button>
      </Modal.Footer>
    </Modal>
  );
};