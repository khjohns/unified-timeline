// DIFF SOM MÅ FLETTES INN (NB; linjenr ikke helt korrekt
// Endring: Legger til mulighet for å holde tilbake betaling (§ 30.2), sjekke passivitet på EP-justering (§ 34.3.3) og avvise rigg-krav formelt.

--- RespondVederlagModal_Old.tsx
+++ RespondVederlagModal_New.tsx
@@ -7,9 +7,16 @@
 
   // Sjekk om vi er i subsidiær modus
   const erSubsidiaer = grunnlagStatus === 'AVVIST'; 
+  const { metode, regningsarbeid, enhetspris, saerskiltKrav } = vederlagEvent;
+
+  // NYTT: Logikk for § 30.2 (Mangler overslag)
+  const kanHoldeTilbake = metode === 'REGNINGSARBEID' && !regningsarbeid.kostnadsOverslag;
+  
+  // NYTT: Logikk for § 34.3.3 (Passivitet EP-justering)
+  const maSvarePaJustering = metode === 'ENHETSPRISER' && enhetspris.kreverJustering;
 
   return (
-    <Modal title={erSubsidiaer ? "Subsidiært svar på vederlag" : "Svar på vederlagskrav"} size="lg">
+    <Modal title="..." size="lg">
       <div className="space-y-6">
 
+        {/* NYTT: Advarsel om svarplikt på justering */}
+        {maSvarePaJustering && (
+           <Alert variant="danger">
+             TE krever justerte enhetspriser. Hvis du er uenig MÅ du svare nå (§ 34.3.3).
+           </Alert>
+        )}
+
         <RadioGroup
           value={svar}
           onChange={setSvar}
           options={[
             { value: 'GODKJENT', label: 'Godkjenn kravet/tilbudet' },
             { value: 'AVVIST_BELOP', label: 'Avslå beløpets størrelse' },
+            
+            // NYTT: Tilbakeholdelse § 30.2
+            ...(kanHoldeTilbake ? [{
+              value: 'HOLD_TILBAKE', 
+              label: 'Hold tilbake betaling (Mangler overslag § 30.2)',
+              description: 'Du nekter å betale før TE leverer kostnadsoverslag.'
+            }] : []),
+
+            // NYTT: Avvisning av Rigg pga frist
+            ...(saerskiltKrav ? [{
+              value: 'AVVIST_PREKLUSJON_RIGG', 
+              label: 'Avvis Rigg/Drift (For sent varslet § 34.1.3)'
+            }] : []),
+
             { value: 'AVVIST_METODE', label: `Avslå bruk av ${vederlagEvent.metode_label}` }
           ]}
         />

// SLUTT DIFF

import React, { useState } from 'react';
import { Modal, Button, RadioGroup, Alert, TextArea, Badge } from '@your-design-system';

export const RespondVederlagModal = ({ vederlagEvent, grunnlagStatus, onSubmit, onClose }) => {
  const [svar, setSvar] = useState('');
  const [kommentar, setKommentar] = useState('');

  // Sjekk om vi er i subsidiær modus (Grunnlaget er avvist)
  const erSubsidiaer = grunnlagStatus === 'AVVIST'; // Eller status fra GrunnlagEvent

  // Teksthjelpere basert på metode
  const erTilbud = vederlagEvent.metode === 'FASTPRIS_TILBUD';
  const erRegning = vederlagEvent.metode === 'REGNINGSARBEID';

  const handleSubmit = () => {
    onSubmit({
      type: 'SVAR_PA_VEDERLAG',
      payload: {
        vederlagId: vederlagEvent.id,
        svar, // GODKJENT, AVVIST_BELOP, AVVIST_METODE
        kommentar,
        erSubsidiaerSvar: erSubsidiaer
      }
    });
  };

  return (
    <Modal 
      title={erSubsidiaer ? "Subsidiært svar på vederlag" : "Svar på vederlagskrav"} 
      size="lg"
      headerElement={erSubsidiaer && <Badge variant="warning">Subsidiær behandling</Badge>}
    >
      <div className="space-y-6">

        {/* Info om Subsidiæritet */}
        {erSubsidiaer && (
          <Alert variant="warning" title="Viktig prinsipp">
            Du har avvist ansvarsgrunnlaget i denne saken. 
            Dine svar nedenfor gjelder derfor <strong>kun subsidiært</strong>.
            <ul className="list-disc pl-5 mt-2 text-sm">
              <li>Hvis du svarer "Godkjenn": Du godkjenner beløpet, men opprettholder at du ikke skal betale det (ingen endring).</li>
              <li>Dette hindrer at du senere møter et ukontrollert krav hvis Entreprenøren vinner frem med endringskravet.</li>
            </ul>
          </Alert>
        )}

        {/* Visning av kravet */}
        <div className="bg-gray-50 p-4 border rounded">
          <div className="flex justify-between items-center">
            <span className="font-bold">{vederlagEvent.metode_label}</span>
            <span className="text-lg font-mono">
              {erRegning ? 'Etter medgått tid' : `kr ${vederlagEvent.belop},-`}
            </span>
          </div>
          {erRegning && (
            <div className="text-sm mt-1">
              Kostnadsoverslag: kr {vederlagEvent.kostnadsOverslag},-
            </div>
          )}
          <p className="text-sm mt-2 text-gray-600">{vederlagEvent.begrunnelse}</p>
        </div>

        {/* Svarsalternativer - Tilpasset metode */}
        <div>
          <label className="label mb-2">Din vurdering av beregningen</label>
          <RadioGroup
            value={svar}
            onChange={setSvar}
            options={[
              {
                value: 'GODKJENT',
                label: erRegning 
                  ? 'Ta overslaget til etterretning (Godta oppstart av regningsarbeid)' 
                  : 'Godkjenn beløpet',
                description: erSubsidiaer 
                  ? 'Beregningen er korrekt, men ansvaret bestrides fortsatt.'
                  : 'Beløpet legges til kontraktssummen.'
              },
              {
                value: 'AVVIST_BELOP',
                label: 'Avslå beløpets størrelse / overslaget',
                description: 'Metoden er grei, men antall timer/enheter eller pris er feil.'
              },
              {
                value: 'AVVIST_METODE',
                label: `Avslå bruk av ${vederlagEvent.metode_label}`,
                description: erTilbud 
                  ? 'Du forkaster fastpristilbudet. Arbeidet utføres da som regningsarbeid (§ 30).' 
                  : 'Du mener kontraktens enhetspriser skal gjelde, eller fastpris skal gis.'
              }
            ]}
          />
        </div>

        {/* Konsekvensvarsler basert på valg */}
        {svar === 'AVVIST_METODE' && erTilbud && (
          <Alert variant="info" className="mt-2">
            Ved å avslå et fastpristilbud (§ 34.2.1), faller oppgjøret tilbake på regningsarbeid (§ 34.4), 
            med mindre dere blir enige om noe annet.
          </Alert>
        )}

        {/* Kommentar */}
        <div>
          <label className="label">
            {svar === 'GODKJENT' ? 'Eventuell kommentar' : 'Begrunnelse for uenighet (Påkrevd)'}
          </label>
          <TextArea 
            value={kommentar} 
            onChange={e => setKommentar(e.target.value)}
            required={svar !== 'GODKJENT'}
            placeholder={svar === 'AVVIST_BELOP' ? "Angi hvilket beløp/kvantum du mener er riktig..." : ""}
          />
        </div>

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button 
          variant={svar?.includes('AVVIST') ? 'danger' : 'primary'} 
          disabled={!svar || (svar !== 'GODKJENT' && !kommentar)} 
          onClick={handleSubmit}
        >
          Send Svar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};