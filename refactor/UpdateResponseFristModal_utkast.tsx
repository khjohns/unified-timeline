import React, { useState } from 'react';
import { 
  Modal, Button, RadioGroup, TextArea, Alert, 
  CurrencyInput 
} from '@your-design-system';

export const UpdateResponseFristModal = ({ lastResponseEvent, currentKravState, onSubmit, onClose }) => {
  const [nyttSvar, setNyttSvar] = useState('');
  const [nyGodkjentDager, setNyGodkjentDager] = useState(0);
  const [kommentar, setKommentar] = useState('');

  // Sjekk om TE har trykket på den store røde knappen
  const erForseringVarslet = currentKravState.erForsering;
  const forseringsKostnad = currentKravState.estimertKostnad;

  // Alternativer avhenger av om forsering er i gang
  const getOptions = () => {
    const baseOptions = [
      { 
        value: 'GODKJENT', 
        label: 'Snu i saken: Godkjenn fristforlengelsen', 
        description: erForseringVarslet 
          ? 'STOPPER FORSERINGEN. TE får dagene, og du slipper å betale forseringskostnaden.' 
          : 'Saken løses ved at TE får dagene.'
      },
      { 
        value: 'DELVIS', 
        label: 'Snu i saken: Godkjenn delvis' 
      }
    ];

    if (erForseringVarslet) {
      baseOptions.push({
        value: 'AVVIST_FORSERING',
        label: 'Oppretthold avslag (Bestrid forsering)',
        description: 'Du mener fortsatt TE ikke har krav på frist. Du tar risikoen for forseringskostnaden.'
      });
    } else {
      // Vanlig omgjøring
      baseOptions.push({ value: 'AVVIST', label: 'Oppretthold avslag' });
    }

    return baseOptions;
  };

  const handleSubmit = () => {
    onSubmit({
      type: 'SVAR_PA_FRIST_OPPDATERT',
      payload: {
        originalSvarId: lastResponseEvent.id,
        nyttSvar,
        nyGodkjentDager: (nyttSvar === 'GODKJENT') ? currentKravState.antallDager : nyGodkjentDager,
        kommentar,
        stopperForsering: (nyttSvar === 'GODKJENT' || nyttSvar === 'DELVIS')
      }
    });
  };

  return (
    <Modal title="Oppdater svar på frist/forsering" size="lg">
      <div className="space-y-6">

        {/* DRAMATISK VARSEL VED FORSERING */}
        {erForseringVarslet && (
          <div className="bg-red-50 p-4 border-l-4 border-red-600 rounded">
            <h4 className="text-red-800 font-bold flex items-center gap-2">
              ⚠️ FORSERING VARSLET
            </h4>
            <p className="text-sm mt-2">
              Entreprenøren har iverksatt forsering med en estimert kostnad på:
            </p>
            <div className="text-2xl font-mono font-bold my-2">
              kr {forseringsKostnad},- 
            </div>
            <p className="text-sm">
              Hvis du godkjenner fristforlengelsen nå, <strong>faller plikten til å forsere bort</strong>. 
              Du betaler da kun evt. påløpt kostnad frem til nå, men slipper resten.
            </p>
          </div>
        )}

        {!erForseringVarslet && (
          <div className="text-sm text-gray-500">
            Nåværende svar: <strong>{lastResponseEvent.svar_label}</strong>
          </div>
        )}

        <RadioGroup 
          label="Ny avgjørelse"
          value={nyttSvar} 
          onChange={setNyttSvar} 
          options={getOptions()}
        />

        {nyttSvar === 'DELVIS' && (
          <div className="ml-6 p-3 bg-gray-100 rounded">
             <Input 
                label="Antall dager" 
                type="number" 
                value={nyGodkjentDager} 
                onChange={e => setNyGodkjentDager(Number(e.target.value))} 
             />
          </div>
        )}

        <TextArea 
          label="Begrunnelse"
          value={kommentar}
          onChange={e => setKommentar(e.target.value)}
          required
          placeholder={erForseringVarslet && nyttSvar === 'GODKJENT' ? "Vi aksepterer fristkravet for å begrense kostnadene..." : "Begrunnelse..."}
        />

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button 
          variant={erForseringVarslet && nyttSvar === 'GODKJENT' ? 'success' : 'primary'} 
          onClick={handleSubmit}
          disabled={!nyttSvar || (nyttSvar === 'DELVIS' && !nyGodkjentDager) || !kommentar}
        >
          {erForseringVarslet && nyttSvar === 'GODKJENT' ? 'Stopp Forsering & Godkjenn' : 'Lagre Svar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};