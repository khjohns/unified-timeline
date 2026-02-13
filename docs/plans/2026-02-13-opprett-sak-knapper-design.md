# Opprett-knapper i SaksoversiktPage

## Kontekst

SaksoversiktPage mangler synlige knapper for å opprette nye saker. I dag finnes kun KOE-opprettelse (TE) via `/saker/ny` og en lenke i PageHeader-menyen. Endringsordre (BH) kan kun opprettes via modal inne i en eksisterende sak.

## Beslutninger

- **Plassering:** Knapp i ProjectIdentityTile (prosjektkortet øverst til venstre)
- **Rollefilter:** BH ser "Ny endringsordre", TE ser "Nytt krav om endring"
- **Scope:** Knapper + ny OpprettEndringsordre-side + delt EndringsordreForm-komponent

## 1. Knapp i ProjectIdentityTile

Sekundær knapp med `+`-ikon, `text-xs`, full bredde. Plassert nederst i kortet med `border-t` separator.

```
┌─ ProjectIdentityTile ─────────┐
│ 🟢 God kontroll               │
│ Oslobygg Prosjekt Alpha       │
│ BH  Oslo kommune              │
│ TE  Veidekke Entreprenør      │
│ ─────────────────────────     │
│ ● 3 venter på ditt svar       │
│ ─────────────────────────     │
│ [+ Ny endringsordre]    (BH)  │
│ [+ Nytt krav om endring] (TE) │
└───────────────────────────────┘
```

Prop `userRole` finnes allerede i ProjectIdentityTile. Knappen bruker `react-router` `Link` til:
- BH: `/endringsordre/ny`
- TE: `/saker/ny`

## 2. OpprettEndringsordre-side

Følger OpprettSakPage-mønsteret. Bruker `EndringsordreForm` (ny delt komponent).

Layout:
- PageHeader: "Opprett endringsordre"
- Identifikasjon: EO-nummer (auto-generert, redigerbar) + Tittel
- Beskrivelse: Fritekst
- Relaterte KOE-saker: Multi-select med kandidater (valgfri)
- Konsekvenser: 5 checkboxes + beskrivelse
- Oppgjør: Oppgjørsform, kompensasjon, fradrag, netto (betinget på pris-konsekvens)
- Fristforlengelse: Dager + ny sluttdato (betinget på fremdrift-konsekvens)
- Handlinger: Avbryt + Opprett endringsordre

API: Eksisterende `opprettEndringsordre()` endepunkt.

## 3. Delt EndringsordreForm-komponent

Samme mønster som GrunnlagForm:
- Tar `UseFormReturn<T>` via props
- Delt schema `endringsordreFormSchema` med Zod
- Brukes av OpprettEndringsordre-side og UtstEndringsordreModal
- Modal beholder wizard-steg, men delegerer felt til shared form
- Betinget rendering via props (f.eks. `showKoeSelection`, `showIdentifikasjon`)

## 4. Filer

| Fil | Endring |
|-----|---------|
| `src/components/dashboard/ProjectIdentityTile.tsx` | Legg til CTA-knapp med rollefilter |
| `src/pages/OpprettEndringsordre.tsx` | **Ny** — EO-opprettelsesside |
| `src/components/forms/EndringsordreForm.tsx` | **Ny** — Delt formkomponent |
| `src/components/endringsordre/UtstEndringsordreModal.tsx` | Refaktorer til EndringsordreForm |
| `src/App.tsx` | Route `/endringsordre/ny` |
