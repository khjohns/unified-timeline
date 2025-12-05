import React, { useState } from 'react';
import { 
  Modal, Button, Input, TextArea, Alert, 
  Checkbox, CurrencyInput, Badge 
} from '@your-design-system';

export const ReviseFristModal = ({ lastFristEvent, lastResponseEvent, onSubmit, onClose }) => {
  // Standard revisjon
  const [nyttAntallDager, setNyttAntallDager] = useState(lastFristEvent.antallDager);
  const [begrunnelse, setBegrunnelse] = useState('');

  // § 33.8 Forsering
  const erAvslag = lastResponseEvent?.svar === 'AVVIST' || lastResponseEvent?.svar === 'DELVIS';
  const [iverksettForsering, setIverksettForsering] = useState(false);
  const [forseringsKostnad, setForseringsKostnad] = useState<number>(0);
  
  // Sjekk av 30% regelen (§ 33.8 første ledd)
  const [bekreft30Prosent, setBekreft30Prosent] = useState(false);

  const handleSubmit = () => {
    // Sjekk om dette er en vanlig revisjon eller et forseringsvarsel
    const eventType = iverksettForsering ? 'EVENT_FORSERING_VARSEL' : 'EVENT_FRIST_REVIDERT';

    onSubmit({
      type: eventType,
      payload: {
        originalFristId: lastFristEvent.id,
        nyttAntallDager: !iverksettForsering ? nyttAntallDager : lastFristEvent.antallDager,
        begrunnelse,
        // Forserings-data
        erForsering: iverksettForsering,
        estimertKostnad: forseringsKostnad,
        datoIverksettelse: new Date()
      }
    });
  };

  return (
    <Modal 
      title={iverksettForsering ? "Varsel om Forsering (§ 33.8)" : "Revider krav om fristforlengelse"} 
      size="lg"
      headerElement={iverksettForsering && <Badge variant="danger">Eskalering</Badge>}
    >
      <div className="space-y-6">
        
        {/* Statusboks */}
        <div className="bg-gray-50 p-3 rounded text-sm border">
          Status: BH har <strong>{lastResponseEvent?.svar_label}</strong> kravet ditt.
        </div>

        {/* HOVEDVALG: Endre dager eller Forsere? */}
        {erAvslag && (
          <div className="border-l-4 border-red-500 pl-4 py-2 bg-red-50">
            <Checkbox 
              label="Svar på avslag: Iverksett forsering (§ 33.8)"
              description="Du velger å anse avslaget som et pålegg om forsering. Du opprettholder fristkravet, men setter inn tiltak for å nå opprinnelig frist."
              checked={iverksettForsering}
              onChange={setIverksettForsering}
            />
          </div>
        )}

        {/* SCENARIO A: Vanlig revisjon (Endre dager) */}
        {!iverksettForsering && (
          <div className="grid grid-cols-2 gap-4 items-end">
            <Input 
              label="Opprinnelig krav (dager)" 
              value={lastFristEvent.antallDager} 
              disabled 
            />
            <Input 
              label="Nytt krav (dager)" 
              type="number"
              value={nyttAntallDager} 
              onChange={e => setNyttAntallDager(Number(e.target.value))} 
            />
          </div>
        )}

        {/* SCENARIO B: Forsering (§ 33.8) */}
        {iverksettForsering && (
          <div className="space-y-4 animate-fadeIn">
            <Alert variant="info">
              <strong>Vilkår for valgrett:</strong> Du kan kun velge forsering dersom kostnaden 
              antas å være mindre enn Dagmulkt + 30%.
            </Alert>

            <CurrencyInput 
              label="Estimert kostnad for forsering (Varsles BH)"
              helperText="Dette blir ditt vederlagskrav hvis BHs avslag var uberettiget."
              value={forseringsKostnad}
              onChange={setForseringsKostnad}
            />

            <Checkbox 
              label="Jeg bekrefter at kostnaden antas å ligge innenfor 30%-regelen (§ 33.8)"
              checked={bekreft30Prosent}
              onChange={setBekreft30Prosent}
            />
            {!bekreft30Prosent && (
              <p className="text-xs text-red-600">
                Hvis kostnaden er høyere, har du ikke valgrett, men må avvente instruks.
              </p>
            )}
          </div>
        )}

        <TextArea 
          label="Begrunnelse" 
          placeholder={iverksettForsering ? "Beskriv tiltakene (skift, overtid, flere ressurser)..." : "Hvorfor endres antall dager?"}
          value={begrunnelse}
          onChange={e => setBegrunnelse(e.target.value)}
          required
        />

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button 
          variant={iverksettForsering ? 'danger' : 'primary'} 
          disabled={!begrunnelse || (iverksettForsering && (!forseringsKostnad || !bekreft30Prosent))} 
          onClick={handleSubmit}
        >
          {iverksettForsering ? 'Send Varsel om Forsering' : 'Oppdater Krav'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};