// Dette er modalen for "Snuoperasjonen". BH har kanskje først avvist, men etter et byggemøte eller mottak av ny dokumentasjon, velger BH å godkjenne for å unngå tvist.
// Kritisk funksjonalitet: Hvis BH endrer fra "Avvist" til "Godkjent", må systemet (i backend/reducer) automatisk oppdatere status på alle tilhørende vederlags- og fristkrav fra "Subsidiær" til "Prinsipal".


import React, { useState } from 'react';
import { Modal, Button, RadioGroup, TextArea, Alert } from '@your-design-system';

export const RespondGrunnlagUpdateModal = ({ lastResponseEvent, onSubmit, onClose }) => {
  const [nyttSvar, setNyttSvar] = useState('');
  const [begrunnelse, setBegrunnelse] = useState('');

  // Hva svarte vi sist?
  const forrigeSvarVarAvslag = lastResponseEvent.svarType === 'AVVIST';

  const getOptions = () => {
    if (forrigeSvarVarAvslag) {
      return [
        { 
          value: 'GODKJENT', 
          label: 'Omgjør til: Godkjent / Endringsordre',
          description: 'Du snur i saken og aksepterer ansvaret. Saken er ikke lenger omtvistet.' 
        },
        { 
          value: 'FRAFALT', 
          label: 'Omgjør til: Frafall pålegget',
          description: 'Du trekker pålegget tilbake. Arbeidet skal ikke utføres.' 
        }
      ];
    }
    // Hvis man allerede har godkjent, er det sjelden man trekker det tilbake, 
    // men det kan skje ved feil.
    return [
      { 
        value: 'AVVIST', 
        label: 'Omgjør til: Avvist (Trekker godkjenning)',
        description: 'NB! Dette er juridisk risikabelt hvis TE allerede har innrettet seg.' 
      }
    ];
  };

  const handleSubmit = () => {
    onSubmit({
      type: 'SVAR_PA_GRUNNLAG_OPPDATERT',
      payload: {
        originalResponseId: lastResponseEvent.id,
        nyttSvar,
        begrunnelse,
        datoEndret: new Date()
      }
    });
  };

  return (
    <Modal title="Endre standpunkt til ansvarsgrunnlag" size="md">
      <div className="space-y-6">
        
        <div className="bg-blue-50 p-3 text-sm rounded border border-blue-200">
          Gjeldende standpunkt: <strong>{lastResponseEvent.svar_label}</strong>
          <br/>
          Begrunnelse: "{lastResponseEvent.begrunnelse}"
        </div>

        <RadioGroup 
          label="Ny beslutning"
          value={nyttSvar} 
          onChange={setNyttSvar} 
          options={getOptions()}
        />

        {/* Konsekvensvarsel ved omgjøring fra AVVIST -> GODKJENT */}
        {forrigeSvarVarAvslag && nyttSvar === 'GODKJENT' && (
          <Alert variant="success">
            <strong>Effekt:</strong> Saken endres fra "Omtvistet" til "Godkjent". 
            Alle eventuelle subsidiære svar du har gitt på Vederlag og Frist vil nå bli gjeldende som <strong>prinsipale</strong> (bindende) avtaler.
          </Alert>
        )}

        {/* Konsekvensvarsel ved omgjøring fra GODKJENT -> AVVIST */}
        {!forrigeSvarVarAvslag && nyttSvar === 'AVVIST' && (
          <Alert variant="danger">
            <strong>Advarsel:</strong> Å trekke en godkjenning/Endringsordre er kun mulig i helt spesielle tilfeller 
            (f.eks. ugyldighet eller bristende forutsetninger). Sørg for at du har juridisk dekning.
          </Alert>
        )}

        <TextArea 
          label="Årsak til endret standpunkt" 
          placeholder="F.eks. 'Ny dokumentasjon mottatt', 'Enighet i byggemøte', 'Feilvurdering'..."
          value={begrunnelse}
          onChange={e => setBegrunnelse(e.target.value)}
          required
        />

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button variant="primary" disabled={!nyttSvar || !begrunnelse} onClick={handleSubmit}>
          Bekreft Endring
        </Button>
      </Modal.Footer>
    </Modal>
  );
};