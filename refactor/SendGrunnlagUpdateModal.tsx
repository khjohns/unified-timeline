// Dette er delikat fordi endringer i grunnlaget kan påvirke varslingsfrister. Hvis Entreprenøren (TE) endrer kategori eller oppdaget dato, kan et krav som var "innenfor" plutselig bli "utenfor".
// Byggherrens (BH) endring er ofte en "snuoperasjon" som endrer rettstilstanden for hele saken.
// Viktig logikk: Hvis TE endrer datoOppdaget til en tidligere dato, eller endrer kategori til noe med strengere frist (f.eks. fra "Endring" til "Irregulær"), må systemet gjøre en ny preklusjonssjekk.

import React, { useState } from 'react';
import { 
  Modal, Button, Input, TextArea, Select, 
  DatePicker, Alert, Accordion 
} from '@your-design-system';
import { differenceInDays } from 'date-fns';
import { krav_struktur_ns8407_komplett } from './data/ns8407_regler';

export const SendGrunnlagUpdateModal = ({ originalEvent, onSubmit, onClose }) => {
  // State initieres med originalverdiene
  const [tittel, setTittel] = useState(originalEvent.tittel);
  const [beskrivelse, setBeskrivelse] = useState(originalEvent.beskrivelse);
  const [datoOppdaget, setDatoOppdaget] = useState(new Date(originalEvent.datoOppdaget));
  const [hovedkategoriKode, setHovedkategoriKode] = useState(originalEvent.kategori.kode);
  
  // Sjekk om endringen skaper problemer for varslingsfristen
  const dagerSidenOpprinneligVarsel = differenceInDays(new Date(originalEvent.datoVarslet), datoOppdaget);
  const bleVarsletSent = dagerSidenOpprinneligVarsel > 14; 
  
  // Sjekk om kategorien endres radikalt
  const erKategoriEndret = hovedkategoriKode !== originalEvent.kategori.kode;

  const handleSubmit = () => {
    onSubmit({
      type: 'EVENT_GRUNNLAG_OPPDATERT',
      payload: {
        eventId: originalEvent.id,
        tittel,
        beskrivelse,
        datoOppdaget, // Kan påvirke fristvurdering
        kategoriKode: hovedkategoriKode, // Kan påvirke hjemmel
        endringsBegrunnelse: "Korrigering av opplysninger / Tilleggsinfo"
      }
    });
  };

  return (
    <Modal title="Oppdater varsel om grunnlag" size="lg">
      <div className="space-y-6">
        
        <Alert variant="info" size="sm">
          Du redigerer nå et eksistert varsel sendt {new Date(originalEvent.datoVarslet).toLocaleDateString()}.
          Endringer her vil bli loggført i historikken.
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Tittel" value={tittel} onChange={e => setTittel(e.target.value)} />
          
          <div>
            <label className="label">Kategori</label>
            <Select 
              value={hovedkategoriKode}
              onChange={e => setHovedkategoriKode(e.target.value)}
              options={krav_struktur_ns8407_komplett.map(k => ({ value: k.kode, label: k.label }))}
            />
          </div>
        </div>

        {/* Dato-logikk */}
        <div className="bg-gray-50 p-4 rounded border">
          <label className="label">Oppdaget dato (Korrigert)</label>
          <DatePicker selected={datoOppdaget} onChange={setDatoOppdaget} />
          
          {bleVarsletSent && (
            <Alert variant="danger" className="mt-3">
              <strong>Advarsel:</strong> Med denne nye datoen fremstår det opprinnelige varselet som sendt for sent 
              (14+ dager etter oppdagelse). Dette kan svekke saken din juridisk.
            </Alert>
          )}
        </div>

        <TextArea 
          label="Beskrivelse / Tilleggsinfo" 
          value={beskrivelse} 
          onChange={e => setBeskrivelse(e.target.value)} 
          rows={5}
        />

        {erKategoriEndret && (
          <Alert variant="warning">
            Du endrer kategorien for kravet. Vær oppmerksom på at dette kan endre spillereglene for saken 
            (f.eks. hvilken varslingsfrist som gjelder eller hvem som har bevisbyrden).
          </Alert>
        )}

      </div>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        <Button variant="primary" onClick={handleSubmit}>Lagre Endringer</Button>
      </Modal.Footer>
    </Modal>
  );
};