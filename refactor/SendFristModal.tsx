import React, { useState } from 'react';
import { 
  Modal, Button, Input, TextArea, DatePicker, 
  Alert, Badge, Accordion 
} from '@your-design-system';
import { differenceInDays } from 'date-fns';

export const SendFristModal = ({ grunnlagEvent, harMottattEtterlysning, onSubmit, onClose }) => {
  const [antallDager, setAntallDager] = useState<number>(0);
  const [nySluttfrist, setNySluttfrist] = useState<Date | null>(null);
  const [begrunnelse, setBegrunnelse] = useState('');
  const [berorteAktiviteter, setBerorteAktiviteter] = useState('');

  // Logikk: Sjekk tidsbruk fra grunnlaget ble varslet (Fase 1 -> Fase 2)
  // Hvis TE har ventet lenge med å spesifisere, slår § 33.6.1 inn (Reduksjon)
  const dagerSidenGrunnlag = differenceInDays(new Date(), new Date(grunnlagEvent.datoVarslet));
  const erSentUtenEtterlysning = !harMottattEtterlysning && dagerSidenGrunnlag > 21; // Tommelfingerregel

  const handleSubmit = () => {
    onSubmit({
      type: 'EVENT_FRIST_KRAV',
      payload: {
        grunnlagId: grunnlagEvent.id,
        antallDager,
        nySluttfrist,
        begrunnelse,
        berorteAktiviteter,
        // Metadata for å spore om dette var tvunget frem
        erSvarPaEtterlysning: harMottattEtterlysning 
      }
    });
  };

  return (
    <Modal 
      title="Spesifisert krav om fristforlengelse" 
      size="lg"
      headerElement={harMottattEtterlysning && <Badge variant="danger">Svar på BHs etterlysning (§ 33.6.2)</Badge>}
    >
      <div className="space-y-6">
        
        <div className="text-sm text-gray-500 border-b pb-2">
          Knyttet til: <strong>{grunnlagEvent.tittel}</strong> ({grunnlagEvent.kategori.label})
        </div>

        {/* SCENARIO 1: Svar på etterlysning (Absolutt preklusjon) */}
        {harMottattEtterlysning && (
          <Alert variant="danger">
            <strong>KRITISK:</strong> Byggherren har etterlyst dette kravet per brev. 
            Du må svare "uten ugrunnet opphold". Hvis du ikke sender kravet nå, 
            <strong>tapes hele retten til fristforlengelse</strong> i denne saken (§ 33.6.2).
          </Alert>
        )}

        {/* SCENARIO 2: Sent krav uten etterlysning (Reduksjon) */}
        {erSentUtenEtterlysning && (
          <Alert variant="warning">
            <strong>Risiko for avkortning (§ 33.6.1):</strong>
            Det er gått {dagerSidenGrunnlag} dager siden du varslet om hendelsen. 
            Når du venter med å spesifisere, har du kun krav på den fristforlengelsen 
            Byggherren "måtte forstå" at du trengte. Begrunn behovet ekstra godt.
          </Alert>
        )}

        {/* Input: Dager og Dato */}
        <div className="grid grid-cols-2 gap-6 bg-blue-50 p-4 rounded border border-blue-100">
          <div>
            <label className="label font-bold text-lg">Krav: Antall dager</label>
            <Input 
              type="number" 
              value={antallDager} 
              onChange={e => setAntallDager(Number(e.target.value))} 
              className="text-2xl font-mono"
              autoFocus
              min={1}
            />
            <p className="text-xs text-gray-500 mt-1">Inkl. helg/helligdager</p>
          </div>
          
          <div>
            <label className="label">Ny sluttfrist (Konsekvens)</label>
            <DatePicker 
              selected={nySluttfrist} 
              onChange={setNySluttfrist} 
              placeholderText="Velg dato..."
            />
          </div>
        </div>

        {/* Begrunnelse - Kobling til § 33.6.1 "Angi og begrunne" */}
        <div>
          <label className="label">
            Begrunnelse for omfanget (Påkrevd)
          </label>
          <TextArea 
            rows={5}
            value={begrunnelse}
            onChange={e => setBegrunnelse(e.target.value)}
            placeholder="Forklar årsakssammenhengen. Hvorfor gir akkurat denne hendelsen dette antallet dager forsinkelse på sluttfristen?"
            required
          />
        </div>

        {/* Kobling til fremdrift - Styrker beviset */}
        <Accordion title="Berørte aktiviteter (Fremdriftsplan)">
          <Input 
            label="Aktiviteter på kritisk linje" 
            placeholder="F.eks. ID 402 Tett Hus, ID 505 Innregulering"
            value={berorteAktiviteter}
            onChange={e => setBerorteAktiviteter(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Dokumentasjon av påvirkning på kritisk linje er avgjørende for å vinne frem med kravet.
          </p>
        </Accordion>

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button 
          variant="primary" 
          disabled={!antallDager || !begrunnelse} 
          onClick={handleSubmit}
        >
          Send Fristkrav
        </Button>
      </Modal.Footer>
    </Modal>
  );
};