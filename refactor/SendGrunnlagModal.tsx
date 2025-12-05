// DIFF SOM MÅ FLETTES INN (NB; linjenr ikke helt korrekt)
// Endring: Legger til sjekk for om lovendringer skjedde etter tilbudsfristen (§ 14.4), samt metadata i payload

--- SendGrunnlagModal_Old.tsx
+++ SendGrunnlagModal_New.tsx
@@ -10,6 +10,9 @@
   const [tittel, setTittel] = useState('');
   const [beskrivelse, setBeskrivelse] = useState('');
   const [datoOppdaget, setDatoOppdaget] = useState(new Date()); 
+  
+  // NYTT: Håndtering av risiko ved lovendringer (§ 14.4)
+  const erLovEndring = ['LOV_GJENSTAND', 'LOV_PROSESS', 'GEBYR'].includes(underkategoriKode);
+  const [erEtterTilbud, setErEtterTilbud] = useState(false);
 
   const handleSubmit = () => {
     onSubmit({
@@ -20,7 +23,8 @@
         beskrivelse,
         datoOppdaget,
         datoVarslet: new Date(),
-        referanser
+        referanser,
+        meta: { erEtterTilbud } // Sendes med for juridisk vurdering
       }
     });
   };
@@ -45,6 +49,18 @@
           </Alert>
         )}
 
+        {/* NYTT: Sjekk mot tilbudet for lovendringer */}
+        {erLovEndring && (
+          <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm">
+            <Checkbox 
+              label="Bekreft at endringen inntraff ETTER tilbudsfristens utløp (§ 14.4)"
+              checked={erEtterTilbud}
+              onChange={setErEtterTilbud}
+            />
+            {!erEtterTilbud && <span className="text-xs text-red-600">Risikoen ligger normalt hos deg.</span>}
+          </div>
+        )}
+
         {/* Seksjon 2: Tidspunkt og Preklusjonssjekk */}
         <div className="bg-gray-50 p-4 rounded-md border border-gray-200">

// SLUTT DIFF

import React, { useState, useMemo } from 'react';
import { 
  Modal, Button, Select, Input, TextArea, 
  DatePicker, Alert, Tooltip, Accordion 
} from '@your-design-system';
import { differenceInDays } from 'date-fns';
import { krav_struktur_ns8407_komplett } from './data/ns8407_regler';

export const SendGrunnlagModal = ({ onSubmit, onClose }) => {
  // State
  const [hovedkategoriKode, setHovedkategoriKode] = useState('');
  const [underkategoriKode, setUnderkategoriKode] = useState('');
  const [tittel, setTittel] = useState('');
  const [beskrivelse, setBeskrivelse] = useState('');
  const [datoOppdaget, setDatoOppdaget] = useState(new Date()); // Default today
  const [referanser, setReferanser] = useState('');

  // Utledet data
  const valgtHovedkategori = krav_struktur_ns8407_komplett.find(k => k.kode === hovedkategoriKode);
  const valgtUnderkategori = valgtHovedkategori?.underkategorier.find(u => u.kode === underkategoriKode);

  // Forretningslogikk: Sjekk varslingsfrist ("Uten ugrunnet opphold")
  const dagerSidenOppdagelse = differenceInDays(new Date(), datoOppdaget);
  const erFristKritisk = dagerSidenOppdagelse > 14; // Tommelfingerregel for "ugrunnet opphold"
  const erFristVarsel = dagerSidenOppdagelse > 3; 

  const handleSubmit = () => {
    onSubmit({
      type: 'EVENT_GRUNNLAG_OPPRETTET',
      payload: {
        kategori: valgtHovedkategori,
        underkategori: valgtUnderkategori,
        tittel,
        beskrivelse,
        datoOppdaget,
        datoVarslet: new Date(), // Alltid NÅ
        referanser
      }
    });
  };

  return (
    <Modal title="Varsle om Endring, Svikt eller Fristforlengelse" size="lg">
      <div className="space-y-6">
        
        {/* Seksjon 1: Hva har skjedd? */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Hovedkategori (Hjemmel kap. VII)</label>
            <Select 
              value={hovedkategoriKode} 
              onChange={e => { setHovedkategoriKode(e.target.value); setUnderkategoriKode(''); }}
              options={krav_struktur_ns8407_komplett.map(k => ({ value: k.kode, label: k.label }))}
            />
            {valgtHovedkategori && (
              <span className="text-xs text-gray-500">{valgtHovedkategori.beskrivelse}</span>
            )}
          </div>

          <div>
            <label className="label">Årsak (Underkategori)</label>
            <Select 
              value={underkategoriKode}
              onChange={e => setUnderkategoriKode(e.target.value)}
              disabled={!hovedkategoriKode}
              options={valgtHovedkategori?.underkategorier.map(u => ({ value: u.kode, label: u.label })) || []}
            />
          </div>
        </div>

        {valgtUnderkategori && (
          <Alert variant="info" title={`Hjemmel: NS 8407 § ${valgtUnderkategori.hjemmel_basis}`}>
            {valgtUnderkategori.beskrivelse}
            <div className="mt-2 font-bold text-xs">
              Varslingskrav: {valgtUnderkategori.varselkrav_ref}
            </div>
          </Alert>
        )}

        {/* Seksjon 2: Tidspunkt og Preklusjonssjekk */}
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <label className="label font-bold">Når ble forholdet oppdaget?</label>
          <div className="flex items-center gap-4">
            <DatePicker 
              selected={datoOppdaget} 
              onChange={date => setDatoOppdaget(date)} 
              maxDate={new Date()} // Kan ikke velge frem i tid
            />
            <span className="text-sm text-gray-600">
              Varsles: {new Date().toLocaleDateString()} ({dagerSidenOppdagelse} dager siden oppdagelse)
            </span>
          </div>

          {/* Dynamisk varsel basert på tid */}
          {erFristKritisk && (
            <Alert variant="danger" className="mt-3">
              <strong>Advarsel: Preklusjonsfare!</strong>
              <br />
              Det er gått {dagerSidenOppdagelse} dager siden forholdet ble oppdaget. 
              NS 8407 krever varsling "uten ugrunnet opphold". 
              Ved å sende dette nå, risikerer du at kravet allerede er tapt. 
              Sørg for å begrunne tidsbruken godt i beskrivelsen under.
            </Alert>
          )}
          {!erFristKritisk && erFristVarsel && (
            <Alert variant="warning" className="mt-3">
              Husk at varsel skal sendes raskest mulig for å sikre bevis og unngå diskusjon om frister.
            </Alert>
          )}
        </div>

        {/* Seksjon 3: Innhold */}
        <div>
          <label className="label">Overskrift på varselet</label>
          <Input 
            value={tittel} 
            onChange={e => setTittel(e.target.value)} 
            placeholder="F.eks. Pålegg om endret føringsvei for ventilasjon"
          />
        </div>

        <div>
          <label className="label">Beskrivelse av hendelsen/forholdet</label>
          <TextArea 
            value={beskrivelse} 
            onChange={e => setBeskrivelse(e.target.value)} 
            rows={5}
            placeholder="Beskriv hva som har skjedd, referer til samtaler, e-poster eller tegninger..."
          />
          <span className="text-xs text-gray-500">
            Dette er et nøytralt varsel om grunnlaget. Spesifiserte krav om penger (Vederlag) 
            og tid (Frist) legger du til i egne steg etterpå.
          </span>
        </div>

        <Accordion title="Legg til referanser (Valgfritt)">
          <Input 
            label="Referanse til tegning/referat"
            value={referanser} 
            onChange={e => setReferanser(e.target.value)} 
          />
        </Accordion>

      </div>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button 
          variant="primary" 
          disabled={!hovedkategoriKode || !underkategoriKode || !tittel} 
          onClick={handleSubmit}
        >
          Send Varsel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};