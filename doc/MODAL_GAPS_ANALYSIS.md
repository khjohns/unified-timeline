# Modal Gap Analysis - Eksisterende vs. Spesifikasjon

## Oversikt

| Modal | Kritiske mangler | Prioritet |
|-------|------------------|-----------|
| RespondGrunnlagModal | BH passivitet, FM-støtte, Frafall, Subsidiær-info | Høy |
| SendVederlagModal | Subsidiær-alert, Preklusjonsvarsler med datosjekk | Medium |
| RespondVederlagModal | §30.2 tilbakeholde, §34.1.3 rigg-avvis, Subsidiær-badge | Høy |
| SendFristModal | BH etterlysning, §33.6.1 reduksjon, Aktiviteter | Medium |
| RespondFristModal | §33.8 forseringsvarsel, Subsidiær-badge, Frist-visning | Høy |

---

## 1. RespondGrunnlagModal

### Mangler fra spesifikasjon:

1. **BH Passivitet (§32.3)** - KRITISK
   ```tsx
   const dagerSidenMottak = differenceInDays(new Date(), new Date(grunnlagEvent.datoVarslet));
   const erPassiv = erIrregulaer && dagerSidenMottak > 10;

   {erPassiv && svarType === 'AVVIST' && (
     <Alert variant="danger">
       Du har brukt {dagerSidenMottak} dager på å svare.
       Ved irregulær endring kan passivitet medføre at endringen anses akseptert (§32.3).
     </Alert>
   )}
   ```

2. **Force Majeure-håndtering**
   - Mangler "ERKJENN_FM" valg når kategori er FORCE_MAJEURE

3. **Frafall-valg (§32.3 c)**
   - Mangler valget "Frafall pålegget" for irregulære endringer

4. **Visning av grunnlagsdetaljer**
   - Mangler visning av kategori, beskrivelse, datoer fra grunnlagEvent

5. **Subsidiær behandling info**
   - Mangler info om konsekvenser av avslag (vederlag/frist behandles subsidiært)

6. **EO-generering info**
   - Mangler info om at godkjenning automatisk genererer Endringsordre

### Props som trengs:
```tsx
interface RespondGrunnlagModalProps {
  grunnlagEvent: {
    id: string;
    hovedkategori: string;
    underkategori: string[];
    beskrivelse: string;
    datoOppdaget: string;
    datoVarslet: string;
  };
  // ... eksisterende props
}
```

---

## 2. SendVederlagModal

### Mangler fra spesifikasjon:

1. **Subsidiær alert**
   ```tsx
   {grunnlagStatus === 'AVVIST' && (
     <Alert variant="info">
       Ansvarsgrunnlaget er avvist av Byggherre.
       Du sender nå inn dette kravet for subsidiær behandling.
     </Alert>
   )}
   ```

2. **Preklusjonssjekk med dato**
   - Implementasjonen har varsling men mangler automatisk datoberegning som viser "X dager siden"

3. **Grunnlag-kontekst**
   - Mangler visning av tilknyttet grunnlag (tittel, status)

### Props som trengs:
```tsx
interface SendVederlagModalProps {
  grunnlagEvent?: {
    id: string;
    tittel: string;
    status: 'GODKJENT' | 'AVVIST';
  };
  // ... eksisterende props
}
```

---

## 3. RespondVederlagModal

### Mangler fra spesifikasjon:

1. **Subsidiær badge og info** - KRITISK
   ```tsx
   {erSubsidiaer && (
     <Badge variant="warning">Subsidiær behandling</Badge>
     <Alert variant="warning">
       Dine svar gjelder kun subsidiært. Du godkjenner beløpet,
       men opprettholder at du ikke skal betale (ingen endring).
     </Alert>
   )}
   ```

2. **§30.2 Tilbakeholdelse** - KRITISK
   ```tsx
   // Nytt valg når regningsarbeid uten overslag
   { value: 'hold_tilbake', label: 'Hold tilbake (§30.2)' }
   ```

3. **§34.1.3 Rigg-preklusjon**
   ```tsx
   // Nytt valg når rigg/drift er for sent varslet
   { value: 'avvist_preklusjon_rigg', label: 'Avvis Rigg/Drift (§34.1.3)' }
   ```

4. **§34.3.3 EP-justering varsel**
   ```tsx
   {kreverJustertEP && (
     <Alert variant="danger">
       TE krever justerte enhetspriser. Hvis du er uenig MÅ du svare nå (§34.3.3).
     </Alert>
   )}
   ```

5. **Visning av vederlagskrav**
   - Mangler visning av metode, beløp, begrunnelse fra kravet

### Props som trengs:
```tsx
interface RespondVederlagModalProps {
  vederlagEvent: {
    id: string;
    krav_belop: number;
    metode: VederlagsMetode;
    begrunnelse: string;
    inkluderer_rigg_drift?: boolean;
    krever_justert_ep?: boolean;
    kostnadsOverslag?: number;
  };
  grunnlagStatus: 'GODKJENT' | 'AVVIST';
  // ... eksisterende props
}
```

---

## 4. SendFristModal

### Mangler fra spesifikasjon:

1. **BH etterlysning (§33.6.2)** - KRITISK
   ```tsx
   {harMottattEtterlysning && (
     <Badge variant="danger">Svar på BHs etterlysning</Badge>
     <Alert variant="danger">
       KRITISK: Hvis du ikke sender kravet nå, tapes hele retten
       til fristforlengelse (§33.6.2).
     </Alert>
   )}
   ```

2. **§33.6.1 Reduksjonsvarsel**
   ```tsx
   {erSentUtenEtterlysning && (
     <Alert variant="warning">
       Risiko for avkortning (§33.6.1): Det er gått {dagerSidenGrunnlag} dager.
       Du har kun krav på det BH "måtte forstå".
     </Alert>
   )}
   ```

3. **Berørte aktiviteter**
   - Mangler felt for aktiviteter på kritisk linje

4. **Grunnlag-kontekst**
   - Mangler visning av tilknyttet grunnlag (tittel, kategori)

### Props som trengs:
```tsx
interface SendFristModalProps {
  grunnlagEvent?: {
    id: string;
    tittel: string;
    kategori: string;
    datoVarslet: string;
  };
  harMottattEtterlysning?: boolean;
  // ... eksisterende props
}
```

---

## 5. RespondFristModal

### Mangler fra spesifikasjon:

1. **§33.8 Forseringsvarsel** - KRITISK
   ```tsx
   {(svar === 'AVVIST' || svar === 'DELVIS') && (
     <Alert variant="info">
       Ved avslag kan TE velge å anse dette som pålegg om forsering (§33.8).
       TE må i så fall sende kostnadsoverslag før iverksettelse.
     </Alert>
   )}
   ```

2. **Subsidiær badge og info**
   - Mangler badge og forklaring om subsidiær behandling

3. **Visning av fristkrav**
   - Mangler visning av antall dager, ny sluttfrist, begrunnelse fra kravet

### Props som trengs:
```tsx
interface RespondFristModalProps {
  fristEvent: {
    id: string;
    antallDager: number;
    nySluttfrist?: string;
    begrunnelse: string;
  };
  grunnlagStatus: 'GODKJENT' | 'AVVIST';
  // ... eksisterende props
}
```

---

## Implementeringsplan

### Prioritet 1 (Kritisk juridisk)
1. RespondGrunnlagModal - BH passivitet + Force Majeure
2. RespondVederlagModal - §30.2 tilbakeholde + Subsidiær
3. RespondFristModal - §33.8 forsering + Subsidiær

### Prioritet 2 (Viktig)
4. SendFristModal - BH etterlysning + §33.6.1
5. SendVederlagModal - Subsidiær alert + grunnlag-kontekst

---

*Generert: 2025-12-05*
