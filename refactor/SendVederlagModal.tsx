// DIFF SOM MÅ FLETTES INN (NB; linjenr ikke helt korrekt
// Endring: Splitter beløp i Direkte vs. Særskilt (Rigg/Drift) for å håndtere ulike varslingsfrister, og tillater negative beløp (Fradrag).

--- SendVederlagModal_Old.tsx
+++ SendVederlagModal_New.tsx
@@ -1,4 +1,5 @@
+import { differenceInDays } from 'date-fns';
 
 export const SendVederlagModal = ({ grunnlagEvent, onSubmit, onClose }) => {
   const [metode, setMetode] = useState<Metode>('ENHETSPRISER');
-  const [belop, setBelop] = useState<number>(0);
+  // ENDRET: Omdøpt for klarhet, støtter negative tall (fradrag)
+  const [belopDirekte, setBelopDirekte] = useState<number>(0); 
+  
+  // NYTT: Særskilte krav (§ 34.1.3)
+  const [harRiggKrav, setHarRiggKrav] = useState(false);
+  const [belopSaerskilt, setBelopSaerskilt] = useState<number>(0);
+  const [datoKlarOver, setDatoKlarOver] = useState(new Date());
+  
+  // Logikk: Sjekk frist for rigg/drift
+  const dagerSidenKlarOver = differenceInDays(new Date(), datoKlarOver);
+  const erRiggFristKritisk = harRiggKrav && dagerSidenKlarOver > 7;
 
   const handleSubmit = () => {
     onSubmit({
       type: 'EVENT_VEDERLAG_KRAV',
       payload: {
         grunnlagId: grunnlagEvent.id,
         metode,
-        belop: metode === 'REGNINGSARBEID' ? null : belop,
+        belopDirekte: metode === 'REGNINGSARBEID' ? null : belopDirekte,
+        saerskiltKrav: harRiggKrav ? { belop: belopSaerskilt, dato: datoKlarOver } : null,
         erArbeidUtfort,
         kreverJusteringEP,
         begrunnelse
@@ -40,9 +53,10 @@
         {metode === 'ENHETSPRISER' && (
           <div className="bg-gray-50 p-4 rounded">
             <CurrencyInput 
-              label="Sum basert på kontraktens enhetspriser"
-              value={belop}
-              onChange={setBelop}
+              label="Sum direkte kostnader (Bruk minus for fradrag)"
+              helperText="Fradrag skal gjøres med reduksjon for fortjeneste (§ 34.4)"
+              value={belopDirekte}
+              onChange={setBelopDirekte}
             />
             <div className="mt-4">
               <Checkbox 
@@ -58,6 +72,21 @@
           </div>
         )}
 
+        {/* NYTT: Særskilt varsel for Rigg/Drift (§ 34.1.3) */}
+        <div className="border border-orange-200 bg-orange-50 p-4 rounded">
+          <Checkbox label="Krav om dekning av Rigg/Drift/Produktivitet?" checked={harRiggKrav} onChange={setHarRiggKrav} />
+          {harRiggKrav && (
+            <div className="mt-3">
+               <CurrencyInput label="Estimert beløp" value={belopSaerskilt} onChange={setBelopSaerskilt} />
+               <label>Dato oppdaget:</label>
+               <DatePicker selected={datoKlarOver} onChange={setDatoKlarOver} />
+               {erRiggFristKritisk && (
+                 <Alert variant="danger">Risiko for preklusjon! Rigg/Drift krever særskilt varsel uten ugrunnet opphold.</Alert>
+               )}
+            </div>
+          )}
+        </div>


// SLUTT DIFF

// ENDRING/TILLEGG 2:
{grunnlagEvent.status === 'AVVIST' && (
  <Alert variant="info" size="sm" className="mb-4">
    <strong>Merk:</strong> Ansvarsgrunnlaget er avvist av Byggherre. 
    Du sender nå inn dette kravet for <strong>subsidiær behandling</strong>. 
    Dette sikrer at kravet ditt er registrert og beregnet iht. fristene i NS 8407.
  </Alert>
)}
// SLUTT ENDRING 2:


type VederlagPayload = {
  grunnlagId: string;
  metode: 'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD';
  
  // Direkte kostnader
  belopDirekte: number;
  
  // Særskilte krav (§ 34.1.3)
  saerskiltKrav: {
    riggDrift: boolean;
    produktivitet: boolean; // "Plunder og heft"
    belop?: number;
    datoKlarOverUtgifter: Date; // For å sjekke frist
  };

  // Metodespesifikke flagg
  regningsarbeid: {
    varsletForOppstart: boolean; // § 34.4
    kostnadsOverslag?: number;
  };
  enhetspris: {
    kreverJustering: boolean; // § 34.3.3
    begrunnelseJustering?: string;
  };
  
  dokumentasjon: string;
};

import React, { useState } from 'react';
import { 
  Modal, Button, RadioGroup, Checkbox, 
  CurrencyInput, DatePicker, Alert, TextArea, Accordion 
} from '@your-design-system';
import { differenceInDays } from 'date-fns';

export const SendVederlagModal = ({ grunnlagEvent, onSubmit, onClose }) => {
  // Typer for beregningsmetode iht NS 8407
  const [metode, setMetode] = useState<'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD'>('ENHETSPRISER');
  
  // Økonomi
  const [belopDirekte, setBelopDirekte] = useState<number>(0);
  
  // Særskilte krav (§ 34.1.3) - Disse har STRENGERE varslingsfrist
  const [harRiggKrav, setHarRiggKrav] = useState(false);
  const [harProduktivitetKrav, setHarProduktivitetKrav] = useState(false);
  const [belopSaerskilt, setBelopSaerskilt] = useState<number>(0);
  const [datoKlarOver, setDatoKlarOver] = useState(new Date());

  // Spesifikke flagg
  const [varsletForOppstart, setVarsletForOppstart] = useState(true); // For Regning
  const [kreverJustertEP, setKreverJustertEP] = useState(false); // For Enhetspris

  // Logikk: Sjekk frist for særskilte krav (§ 34.1.3)
  const dagerSidenKlarOver = differenceInDays(new Date(), datoKlarOver);
  const erRiggFristKritisk = (harRiggKrav || harProduktivitetKrav) && dagerSidenKlarOver > 7;

  return (
    <Modal title="Krav om Vederlagsjustering" size="lg">
      <div className="space-y-6">
        
        {/* Info om grunnlaget */}
        <div className="text-sm text-gray-500 border-b pb-2">
          Knyttet til: <strong>{grunnlagEvent.tittel}</strong>
        </div>

        {/* 1. Beregningsmetode */}
        <div>
          <label className="label">Beregningsmetode (§ 34.2)</label>
          <RadioGroup 
            value={metode} 
            onChange={setMetode}
            horizontal
            options={[
              { value: 'ENHETSPRISER', label: 'Enhetspriser' },
              { value: 'REGNINGSARBEID', label: 'Regningsarbeid' },
              { value: 'FASTPRIS_TILBUD', label: 'Fastpris (Tilbud)' }
            ]}
          />
        </div>

        {/* 2. Direkte kostnader (Metodespesifikk) */}
        <div className="bg-gray-50 p-4 rounded border">
          <h4 className="font-bold text-sm mb-3">Direkte kostnader (Materialer/Arbeid)</h4>
          
          {metode === 'ENHETSPRISER' && (
            <>
              <CurrencyInput 
                label="Sum iht. kontraktens enhetspriser" 
                value={belopDirekte} 
                onChange={setBelopDirekte} 
              />
              <div className="mt-3">
                <Checkbox 
                  label="Krever JUSTERING av enhetsprisene (§ 34.3.3)?" 
                  checked={kreverJustertEP} 
                  onChange={setKreverJustertEP} 
                />
                {kreverJustertEP && (
                  <Alert variant="warning" size="sm" className="mt-1">
                    <strong>OBS:</strong> Krav om justert enhetspris må varsles "uten ugrunnet opphold" 
                    etter at forholdet oppsto. Hvis ikke, får du kun det BH "måtte forstå".
                  </Alert>
                )}
              </div>
            </>
          )}

          {metode === 'REGNINGSARBEID' && (
            <>
              <Alert variant="info" size="sm" className="mb-3">
                Ved regningsarbeid faktureres kostnadene løpende. Dette varselet gjelder oppstarten.
              </Alert>
              <Checkbox 
                label="Er Byggherren varslet FØR arbeidet startet? (§ 34.4)" 
                checked={varsletForOppstart} 
                onChange={setVarsletForOppstart} 
              />
              {!varsletForOppstart && (
                <Alert variant="danger" size="sm" className="mt-1">
                  <strong>Advarsel:</strong> Når du ikke varsler før oppstart, får du en strengere bevisbyrde 
                  for at kostnadene var nødvendige (§ 30 / § 34.4).
                </Alert>
              )}
            </>
          )}

          {metode === 'FASTPRIS_TILBUD' && (
            <CurrencyInput 
              label="Tilbudt fastpris (eks. mva)" 
              value={belopDirekte} 
              onChange={setBelopDirekte} 
            />
          )}
        </div>

        {/* 3. Særskilte krav (§ 34.1.3) - KUN hvis aktuelt */}
        <div className="border p-4 rounded bg-orange-50 border-orange-200">
          <h4 className="font-bold text-sm text-orange-900 mb-2">Særskilte krav (Rigg, Drift, Produktivitet)</h4>
          <p className="text-xs text-orange-800 mb-3">
            NB: Disse postene krever <strong>særskilt varsel</strong>. Kravet tapes totalt ved manglende varsel (§ 34.1.3).
          </p>
          
          <div className="flex gap-4 mb-3">
            <Checkbox label="Økt Rigg/Drift" checked={harRiggKrav} onChange={setHarRiggKrav} />
            <Checkbox label="Nedsatt produktivitet" checked={harProduktivitetKrav} onChange={setHarProduktivitetKrav} />
          </div>

          {(harRiggKrav || harProduktivitetKrav) && (
            <div className="grid grid-cols-2 gap-4 animate-fadeIn">
              <CurrencyInput 
                label="Estimert beløp særskilte krav" 
                value={belopSaerskilt} 
                onChange={setBelopSaerskilt} 
              />
              <div>
                <label className="label">Når ble du klar over disse utgiftene?</label>
                <DatePicker selected={datoKlarOver} onChange={setDatoKlarOver} maxDate={new Date()} />
              </div>
            </div>
          )}

          {erRiggFristKritisk && (
            <Alert variant="danger" className="mt-3">
              <strong>Preklusjonsfare (§ 34.1.3):</strong> Det er gått {dagerSidenKlarOver} dager. 
              Du risikerer at retten til å kreve rigg/drift/produktivitet er tapt fordi varselet ikke er sendt "uten ugrunnet opphold".
            </Alert>
          )}
        </div>

        {/* 4. Dokumentasjon */}
        <TextArea label="Begrunnelse/Dokumentasjon" rows={3} placeholder="Henvis til vedlegg..." />

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button variant="primary" onClick={() => onSubmit({...})}>Send Krav</Button>
      </Modal.Footer>
    </Modal>
  );
};