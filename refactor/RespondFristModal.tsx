import React, { useState } from 'react';
import { 
  Modal, Button, RadioGroup, Alert, TextArea, 
  Badge, Input 
} from '@your-design-system';

export const RespondFristModal = ({ fristEvent, grunnlagStatus, onSubmit, onClose }) => {
  const [svar, setSvar] = useState(''); // 'GODKJENT', 'DELVIS', 'AVVIST'
  const [godkjentDager, setGodkjentDager] = useState<number>(0);
  const [kommentar, setKommentar] = useState('');

  // Sjekk om vi er i subsidiær modus (Grunnlaget er avvist)
  const erSubsidiaer = grunnlagStatus === 'AVVIST';

  const handleSubmit = () => {
    onSubmit({
      type: 'SVAR_PA_FRIST',
      payload: {
        fristId: fristEvent.id,
        svar,
        godkjentAntallDager: (svar === 'GODKJENT') ? fristEvent.antallDager : godkjentDager,
        begrunnelse: kommentar,
        erSubsidiaerSvar: erSubsidiaer
      }
    });
  };

  return (
    <Modal 
      title={erSubsidiaer ? "Subsidiært svar på frist" : "Svar på fristkrav"} 
      headerElement={erSubsidiaer && <Badge variant="warning">Subsidiær behandling</Badge>}
      size="lg"
    >
      <div className="space-y-6">

        {/* Visning av TE sitt krav */}
        <div className="bg-gray-50 p-4 border rounded flex justify-between items-start">
          <div>
            <span className="text-xs text-gray-500 uppercase font-bold">Krav fra Entreprenør</span>
            <div className="text-3xl font-bold mt-1">{fristEvent.antallDager} dager</div>
            <div className="text-sm text-gray-500">Ny sluttfrist: {fristEvent.nySluttfrist ? new Date(fristEvent.nySluttfrist).toLocaleDateString() : 'Ikke angitt'}</div>
          </div>
          <div className="text-right text-sm text-gray-700 max-w-md bg-white p-2 rounded border border-gray-200">
            "{fristEvent.begrunnelse}"
          </div>
        </div>

        {/* Svarsalternativer */}
        <RadioGroup
          label="Din avgjørelse (§ 33.7)"
          value={svar}
          onChange={setSvar}
          options={[
            { 
              value: 'GODKJENT', 
              label: `Godkjenn ${fristEvent.antallDager} dager`,
              description: erSubsidiaer 
                ? 'Antallet dager er korrekt beregnet (gitt at du har ansvar).' 
                : 'Fristen forlenges tilsvarende.'
            },
            { 
              value: 'DELVIS', 
              label: 'Godkjenn delvis (Færre dager)',
              description: 'Du mener TE har beregnet feil eller lagt inn for mye slakk.'
            },
            { 
              value: 'AVVIST', 
              label: 'Avslå kravet fullstendig',
              description: 'Det er ikke grunnlag for fristforlengelse.'
            }
          ]}
        />

        {/* Input for Delvis godkjenning */}
        {svar === 'DELVIS' && (
          <div className="ml-6 p-4 bg-gray-100 rounded animate-fadeIn border-l-4 border-blue-500">
            <Input 
              type="number" 
              label="Antall dager du godkjenner" 
              value={godkjentDager} 
              onChange={e => setGodkjentDager(Number(e.target.value))}
              max={fristEvent.antallDager - 1}
              min={0}
            />
          </div>
        )}

        {/* INFO OM FORSERINGSRISIKO (§ 33.8) - Vises ved Avslag/Delvis */}
        {(svar === 'AVVIST' || (svar === 'DELVIS' && godkjentDager < fristEvent.antallDager)) && (
          <Alert variant="info" title="Informasjon om risiko (§ 33.8)">
            Du avslår nå dager som TE mener å ha krav på.
            <ul className="list-disc pl-5 mt-2 text-sm">
              <li>
                Dersom avslaget ditt er uberettiget, kan TE velge å anse avslaget som et 
                <strong>pålegg om forsering</strong>.
              </li>
              <li>
                TE må i så fall sende et nytt varsel med kostnadsoverslag for forseringen 
                før de setter i gang (Fase 4).
              </li>
              <li>
                Du trenger ikke ta stilling til forsering nå, men vær forberedt på at et slikt krav kan komme.
              </li>
            </ul>
          </Alert>
        )}

        {/* Begrunnelse - Absolutt krav ved avslag/delvis */}
        <TextArea 
          label={svar === 'GODKJENT' ? 'Kommentar (Valgfritt)' : 'Begrunnelse for avslag/avkortning (Påkrevd)'} 
          value={kommentar} 
          onChange={e => setKommentar(e.target.value)} 
          required={svar !== 'GODKJENT'}
          placeholder={svar !== 'GODKJENT' ? "Hvorfor er beregningen feil? Vis til fremdriftsplan eller manglende årsakssammenheng." : ""}
        />

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button 
          variant={svar !== 'GODKJENT' ? 'danger' : 'primary'} 
          disabled={!svar || (svar === 'DELVIS' && !godkjentDager) || (svar !== 'GODKJENT' && !kommentar)} 
          onClick={handleSubmit}
        >
          Send Svar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};