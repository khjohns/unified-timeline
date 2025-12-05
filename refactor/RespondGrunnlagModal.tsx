// DIFF SOM MÅ FLETTES INN (NB; linjenr ikke helt korrekt)
// Endring: Legger til sjekk på om Byggherren selv har vært passiv (§ 32.3) og tilpasser svaralternativer for Force Majeure.
--- RespondGrunnlagModal_Old.tsx
+++ RespondGrunnlagModal_New.tsx
@@ -1,13 +1,19 @@
+import { differenceInDays } from 'date-fns';
 
 export const RespondGrunnlagModal = ({ grunnlagEvent, onSubmit, onClose }) => {
   
   const [svarType, setSvarType] = useState(''); 
   const [begrunnelse, setBegrunnelse] = useState('');
 
   // Hjelpevariabler
   const erIrregulaer = grunnlagEvent.kategori.kode === 'ENDRING' && grunnlagEvent.underkategori.kode === 'IRREG';
+  const erForceMajeure = grunnlagEvent.kategori.kode === 'FORCE_MAJEURE';
+  
+  // NYTT: Sjekk BH passivitet (§ 32.3)
+  const dagerSidenMottak = differenceInDays(new Date(), new Date(grunnlagEvent.datoVarslet));
+  const erPassiv = erIrregulaer && dagerSidenMottak > 10; // Advarsel
 
   return (
     <Modal title={`Svar på varsel: ${grunnlagEvent.tittel}`} size="lg">
@@ -21,11 +27,24 @@
           </p>
         </div>
 
+        {/* NYTT: Advarsel til BH om passivitet */}
+        {erPassiv && svarType === 'AVVIST' && (
+          <Alert variant="danger">
+            Advarsel: Du har brukt {dagerSidenMottak} dager på å svare. 
+            Ved irregulær endring kan passivitet medføre at endringen anses akseptert (§ 32.3).
+          </Alert>
+        )}
+
         <div>
           <RadioGroup 
             value={svarType} 
             onChange={setSvarType}
             options={[
+              // NYTT: Tilpasset alternativ for Force Majeure
+              ...(erForceMajeure ? [{
+                 value: 'ERKJENN_FM', label: 'Erkjenn at forholdet er Force Majeure'
+              }] : [
               { 
                 value: 'GODKJENT', 
                 label: erSvikt ? 'Erkjenn ansvar/svikt' : 'Godkjenn som endring (Utsted Endringsordre)',
@@ -33,7 +52,7 @@
               },
               { 
                 value: 'AVVIST', 
                 label: 'Avslå grunnlaget',
-              },
+              }]),
               ...(erIrregulaer ? [{ 
                 value: 'FRAFALT',
// SLUTT DIFF

import React, { useState } from 'react';
import { Modal, Button, RadioGroup, TextArea, Alert, Checkbox } from '@your-design-system';

// Props kommer fra eventet som TE sendte over
export const RespondGrunnlagModal = ({ grunnlagEvent, onSubmit, onClose }) => {
  
  const [svarType, setSvarType] = useState(''); // 'GODKJENT', 'AVVIST', 'FRAFALT'
  const [begrunnelse, setBegrunnelse] = useState('');
  const [erkjennProsessAnsvar, setErkjennProsessAnsvar] = useState(false);

  // Hjelpevariabler
  const erIrregulaer = grunnlagEvent.kategori.kode === 'ENDRING' && grunnlagEvent.underkategori.kode === 'IRREG';
  const erSvikt = grunnlagEvent.kategori.kode === 'SVIKT';

  const handleSubmit = () => {
    onSubmit({
      type: 'SVAR_PA_GRUNNLAG',
      payload: {
        grunnlagId: grunnlagEvent.id,
        svarType,
        begrunnelse,
        erDisputed: svarType === 'AVVIST', // Dette flagget styrer logikken i neste modaler
        erFrafalt: svarType === 'FRAFALT'
      }
    });
  };

  return (
    <Modal title={`Svar på varsel: ${grunnlagEvent.tittel}`} size="lg">
      <div className="space-y-6">
        
        {/* Oppsummering av hva TE har sendt */}
        <div className="bg-blue-50 p-4 border-l-4 border-blue-500 rounded">
          <h4 className="font-bold text-sm text-blue-900">Entreprenørens påstand:</h4>
          <p className="text-sm mt-1">{grunnlagEvent.kategori.label} - {grunnlagEvent.underkategori.label}</p>
          <p className="italic text-gray-700 mt-2">"{grunnlagEvent.beskrivelse}"</p>
          <p className="text-xs text-gray-500 mt-2">
            Varslet: {new Date(grunnlagEvent.datoVarslet).toLocaleDateString()} 
            (Oppdaget: {new Date(grunnlagEvent.datoOppdaget).toLocaleDateString()})
          </p>
        </div>

        {/* Hovedvalg: Aksept eller Avslag */}
        <div>
          <label className="label font-bold mb-2">Din avgjørelse</label>
          <RadioGroup 
            value={svarType} 
            onChange={setSvarType}
            options={[
              { 
                value: 'GODKJENT', 
                label: erSvikt ? 'Erkjenn ansvar/svikt' : 'Godkjenn som endring (Utsted Endringsordre)',
                description: 'Du aksepterer at dette gir grunnlag for justering. Pris/Tid behandles separat.'
              },
              { 
                value: 'AVVIST', 
                label: 'Avslå grunnlaget',
                description: 'Du mener forholdet er en del av kontrakten eller TE sin risiko.'
              },
              // Kun vis dette valget ved irregulær endring (NS 8407 § 32.3 c)
              ...(erIrregulaer ? [{ 
                value: 'FRAFALT', 
                label: 'Frafall pålegget (§ 32.3 c)',
                description: 'Arbeidet skal IKKE utføres. Endringssaken bortfaller.'
              }] : [])
            ]}
          />
        </div>

        {/* Logikk for Avslag: Forklar subsidiær behandling */}
        {svarType === 'AVVIST' && (
          <Alert variant="warning">
            <strong>Konsekvens av avslag:</strong><br/>
            Saken markeres som <em>omtvistet</em>. Entreprenøren vil likevel kunne sende inn krav om Vederlag og Frist.
            Du må da behandle disse kravene <strong>subsidiært</strong> (dvs. "hva kravet hadde vært verdt <em>hvis</em> du tok feil om ansvaret").
            <br/><br/>
            Dette sikrer at dere får avklart uenighet om beregning (utmåling) tidlig, selv om dere er uenige om ansvaret.
          </Alert>
        )}

        {/* Logikk for Godkjenning: Utstedelse av EO */}
        {svarType === 'GODKJENT' && !erSvikt && (
          <Alert variant="success">
            <strong>Systemhandling:</strong><br/>
            Når du klikker "Send Svar", vil systemet automatisk generere en formell <strong>Endringsordre (EO)</strong> basert på dette varselet, jf. NS 8407 § 31.3.
          </Alert>
        )}

        {/* Begrunnelse */}
        <div>
          <label className="label">
            {svarType === 'AVVIST' ? 'Begrunnelse for avslag (Påkrevd)' : 'Kommentar / Presisering'}
          </label>
          <TextArea 
            value={begrunnelse} 
            onChange={e => setBegrunnelse(e.target.value)} 
            required={svarType === 'AVVIST'}
            rows={4}
          />
        </div>

      </div>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button 
          variant={svarType === 'AVVIST' ? 'danger' : 'primary'} 
          disabled={!svarType || (svarType === 'AVVIST' && !begrunnelse)} 
          onClick={handleSubmit}
        >
          Send Svar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};