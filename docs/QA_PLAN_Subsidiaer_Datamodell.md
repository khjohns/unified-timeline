# Kvalitetssikringsplan: Subsidiær standpunkt-lagring

> **Formål**: Verifisere at implementasjonsplanen `IMPLEMENTATION_PLAN_Subsidiaer_Datamodell.md` er korrekt, komplett og i tråd med NS 8407:2011.
>
> **Dato**: 2025-12-09
> **Status**: Verifisert - med anbefalinger

---

## 1. Sammendrag

Denne planen definerer kvalitetssikringsaktiviteter for implementasjonsplanen for subsidiær standpunkt-lagring. Kvalitetssikringen fokuserer på:

1. **Prosessmessig korrekthet** - Samsvar med NS 8407:2011 for korrekt saksgang
2. **Teknisk fullstendighet** - Alle nødvendige endringer dekket
3. **Arkitekturell konsistens** - Følger eksisterende mønstre
4. **Praktisk gjennomførbarhet** - Realistiske implementeringsoppgaver

> **Merk**: Datamodellen er ikke ment som juridisk dokumentasjon (PDF genereres for dette), men må støtte en korrekt og brukervennlig prosess for både TE og BH, samt muliggjøre analyse.

---

## 2. Kontrollpunkter mot NS 8407 - VERIFISERT

### 2.1 Fristforlengelse (Kapittel VII, §33)

| Paragraf | Krav i NS 8407 | Status | Verifisering |
|----------|----------------|--------|--------------|
| §33.1 | Totalentreprenørens krav på fristforlengelse pga. byggherrens forhold | ✅ OK | Implementasjonsplanen håndterer BH-respons på fristkrav |
| §33.4 | **Varsel om fristforlengelse** - "uten ugrunnet opphold" | ✅ OK | `PREKLUSJON_NOYTRALT` dekker dette. NS 8407: "Krav på fristforlengelse tapes dersom det ikke varsles innen utløpet av fristen." |
| §33.5 | **Beregning av fristforlengelse** - virkning på fremdrift | ✅ OK | `INGEN_HINDRING` er korrekt. NS 8407 §33.5: "Fristforlengelsen skal svare til den virkning på fremdriften som forhold [...] har forårsaket". BH kan mene at forholdet ikke forårsaket faktisk fremdriftshindring. |
| §33.6 | **Spesifisering av krav** - uten ugrunnet opphold | ✅ OK | `PREKLUSJON_SPESIFISERT` dekker dette. NS 8407: "Gjør han ikke dette, har han bare krav på slik fristforlengelse som den andre parten måtte forstå..." |
| §33.7 | Partens svarplikt | ✅ OK | Implementert via respons-events |

### 2.2 Vederlagsjustering (Kapittel VII, §34)

| Paragraf | Krav i NS 8407 | Status | Verifisering |
|----------|----------------|--------|--------------|
| §34.1.1 | Endringer | ✅ OK | Vederlagskrav håndteres via grunnlag-spor |
| §34.1.2 | Svikt i byggherrens ytelser | ✅ OK | Grunnlag-spor dekker dette |
| §34.1.3 | **Særskilt varsel om rigg/drift og produktivitet** | ✅ OK | `PREKLUSJON_RIGG` og `PREKLUSJON_PRODUKTIVITET` - NS 8407: "Gir han ikke slikt varsel, taper han retten til å påberope seg påløpte utgifter..." |
| §34.3.3 | **Varsel om justering av enhetspriser** | ⚠️ Anbefaling | Se seksjon 2.4 nedenfor |

### 2.3 Endringsordre (Kapittel VII, §31)

| Paragraf | Krav i NS 8407 | Status |
|----------|----------------|--------|
| §31.3 | Endringsordre | ✅ OK | EOUtstedtEvent finnes i systemet |

### 2.4 ANBEFALING: EP-justering (§34.3.3)

**Bakgrunn fra NS 8407:**

§34.3.3 sier: *"Den part som vil gjøre krav på justering av enhetsprisene, skal varsle den andre parten uten ugrunnet opphold etter at det foreligger forhold som gir grunnlag for slik justering. Unnlater han dette, har han bare krav på slik justering av enhetsprisen som den andre parten måtte forstå at forholdet ville føre til."*

**Eksisterende håndtering:**
- `VederlagResponsData` har allerede feltet `varsel_justert_ep_ok: Optional[bool]` (linje 667-670 i events.py)
- Dette er en Port 1-vurdering (preklusjon), ikke en subsidiær trigger

**Anbefaling:**

EP-justering bør håndteres **analogt med rigg/drift** fordi:
1. Det er samme juridiske mekanisme (preklusjon ved manglende varsel)
2. BH må kunne ta prinsipalt standpunkt (avvist pga. manglende varsel) OG subsidiært standpunkt (hva hadde beløpet vært med EP-justering)

**Konkret forslag - legg til ny trigger:**

```python
class SubsidiaerTrigger(str, Enum):
    # ... eksisterende ...

    # Nivå 1: Preklusjon (Vederlag) - NY
    PREKLUSJON_EP_JUSTERING = "preklusjon_ep_justering"  # §34.3.3 - EP-justering varslet for sent
```

**Alternativt** kan dette håndteres via det eksisterende feltet `varsel_justert_ep_ok`, men da må frontend-logikken eksplisitt sjekke dette feltet når subsidiære triggere beregnes.

---

## 3. Teknisk kvalitetssikring

### 3.1 Datamodell-konsistens

| Kontrollpunkt | Status | Detaljer |
|---------------|--------|----------|
| SubsidiaerTrigger enum verdier matcher frontend/backend | ✅ OK | Implementasjonsplanen spesifiserer identiske verdier for Python og TypeScript |
| VederlagResponsData felt er Optional der det skal være det | ✅ OK | Alle nye felt er `Optional[...]` |
| FristResponsData felt er Optional der det skal være det | ✅ OK | Alle nye felt er `Optional[...]` |
| Bakoverkompatibilitet med eksisterende data | ✅ OK | Ingen breaking changes - kun nye optional felt |

### 3.2 Anbefalte tillegg

| Element | Status | Anbefaling |
|---------|--------|------------|
| **Validering av subsidiær logikk** | Anbefalt | Backend bør validere at `subsidiaer_godkjent_belop >= godkjent_belop` når subsidiært resultat er mer positivt enn prinsipalt. Dette er en forretningsregel, ikke juridisk krav. |
| **Migrering av eksisterende data** | Ikke nødvendig | Alle nye felt er Optional |
| **PREKLUSJON_EP_JUSTERING trigger** | Anbefalt | Se seksjon 2.4 |

### 3.3 Arkitekturkonsistens

| Område | Vurdering | Kommentar |
|--------|-----------|-----------|
| Event Sourcing-mønster | ✅ Følges | Subsidiære felt lagres i event data |
| Port-modell | ✅ Følges | Subsidiært resultat er "siste port" i beslutningskjeden |
| CQRS | ✅ Følges | State beregnes fra events via TimelineService |
| Pydantic v2 mønstre | ✅ Følges | Field, Optional, computed_field brukes korrekt |

---

## 4. NS 8407-referanser - VERIFISERT

Alle paragrafreferanser i implementasjonsplanen er kontrollert mot NS 8407:2011:

| Referanse i implementasjonsplan | Paragraf | NS 8407 tekst (utdrag) | Status |
|---------------------------------|----------|------------------------|--------|
| "Rigg/drift varslet for sent" | §34.1.3 | "Dersom totalentreprenøren vil kreve justering [...] må han varsle byggherren særskilt uten ugrunnet opphold" | ✅ |
| "Produktivitet varslet for sent" | §34.1.3 | "...økte utgifter på grunn av nedsatt produktivitet eller forstyrrelser på annet arbeid" | ✅ |
| "Nøytralt varsel for sent" | §33.4 | "Krav på fristforlengelse tapes dersom det ikke varsles innen utløpet av fristen" | ✅ |
| "Spesifisert krav for sent" | §33.6 | "Gjør han ikke dette, har han bare krav på slik fristforlengelse som den andre parten måtte forstå..." | ✅ |
| "Ingen reell fremdriftshindring" | §33.5 | "Fristforlengelsen skal svare til den virkning på fremdriften som forhold [...] har forårsaket" | ✅ |

### 4.1 Kombinasjon av triggere

Basert på NS 8407 kan følgende triggere kombineres:

| Kombinasjon | Gyldig? | Begrunnelse |
|-------------|---------|-------------|
| `PREKLUSJON_RIGG` + `PREKLUSJON_PRODUKTIVITET` | ✅ Ja | To uavhengige særskilte krav kan begge være prekludert |
| `PREKLUSJON_RIGG` + `METODE_AVVIST` | ✅ Ja | Rigg kan være prekludert OG BH kan mene at feil metode er brukt på hovedkravet |
| `PREKLUSJON_NOYTRALT` + `INGEN_HINDRING` | ✅ Ja | BH kan mene både for sent varsel OG ingen hindring (kaskade) |
| `GRUNNLAG_AVVIST` + andre | ✅ Ja | Grunnlag-avvisning påvirker ikke vederlag/frist-spesifikke triggere |

**Konklusjon**: Ingen triggere er gjensidig utelukkende. Triggerlisten kan inneholde flere verdier.

---

## 5. UI/UX-kvalitetssikring

### 5.1 Brukeropplevelse

| Kontrollpunkt | Status | Kommentar |
|---------------|--------|-----------|
| Subsidiært standpunkt er visuelt distinkt | ✅ OK | Amber bakgrunn differensierer fra prinsipalt (mørk blå) |
| Trigger-labels er forståelige | ✅ OK | Labels refererer til kontraktsparagrafer |
| Rekkefølge prinsipalt → subsidiært | ✅ OK | Logisk rekkefølge |
| Begrunnelsesfelt er tilgjengelig | ✅ OK | `subsidiaer_begrunnelse` felt finnes |

### 5.2 UI-avgrensning

> **Avklart**: Timeline viser overordnet info, modal viser alle detaljer inkludert subsidiære vurderinger. Ytterligere UI-spesifikasjoner (SakPanel, PDF-eksport) tas etter datamodell og forretningslogikk er implementert.

---

## 6. Testing-kvalitetssikring

### 6.1 Testscenarioer som bør dekkes

| Scenario | Beskrevet i plan | Status |
|----------|------------------|--------|
| Vederlag med prekludert rigg | ✅ Ja | OK |
| Vederlag med prekludert produktivitet | ✅ Implisitt | OK (samme mekanisme som rigg) |
| Vederlag med prekludert EP-justering | ⚠️ Nei | Legg til hvis PREKLUSJON_EP_JUSTERING implementeres |
| Frist med preklusjon + ingen hindring (kaskade) | ✅ Ja | OK |
| Bakoverkompatibilitet - gammel data uten subsidiære felt | ✅ Ja | OK |

### 6.2 Integrasjonstester (anbefalt)

| Test | Prioritet |
|------|-----------|
| E2E: Opprett vederlagskrav → BH respons med subsidiært → Verifiser lagring | Høy |
| E2E: Opprett fristkrav → BH respons med kaskade → Verifiser EventDetailModal | Høy |
| E2E: Verifiser at gammel data uten subsidiære felt fortsatt fungerer | Middels |

---

## 7. Sjekkliste for implementering

### 7.1 Før implementering starter

- [x] **NS 8407-verifisering**: Alle paragrafreferanser kontrollert ✅
- [x] **Teknisk review**: QA-plan gjennomgått ✅
- [x] **UI-avgrensning**: Avklart (modal viser detaljer) ✅
- [ ] **Beslutning**: Skal PREKLUSJON_EP_JUSTERING trigger legges til?

### 7.2 Under implementering

- [ ] **Oppgave 1-3**: Backend datamodeller (events.py)
- [ ] **Oppgave 4-5**: Frontend typer og modaler
- [ ] **Oppgave 7**: BeregningResultat enums (bakoverkompatibilitet)
- [ ] **Oppgave 8-9**: SakState og TimelineService

### 7.3 Etter implementering

- [ ] Alle eksisterende tester passerer
- [ ] Nye tester for subsidiær funksjonalitet
- [ ] Manuell testing av brukerflyt

---

## 8. Anbefalinger - oppsummert

### 8.1 Besluttet

| # | Anbefaling | Beslutning |
|---|------------|------------|
| 1 | **Legg til `PREKLUSJON_EP_JUSTERING` trigger** (§34.3.3) | ✅ Godkjent - lagt til i implementasjonsplanen |

### 8.2 Kan implementeres som del av planen

| # | Anbefaling | Prioritet |
|---|------------|-----------|
| 1 | Backend-validering: `subsidiaer_godkjent_belop >= godkjent_belop` | Lav (forretningsregel) |
| 2 | Integrasjonstester for subsidiær flyt | Middels |

### 8.3 Utsettes til etter datamodell er ferdig

| # | Element |
|---|---------|
| 1 | PDF-visning av subsidiært standpunkt |
| 2 | SakPanel-aggregering |
| 3 | Rapportering/analyse på tvers av saker |

---

## 9. Konklusjon

**Implementasjonsplanen er verifisert og klar for implementering.**

Alle NS 8407-referanser er korrekte, arkitekturen følger eksisterende mønstre, og bakoverkompatibilitet er ivaretatt.

`PREKLUSJON_EP_JUSTERING` trigger er lagt til i implementasjonsplanen for å håndtere §34.3.3 (varsel om justering av enhetspriser) på samme måte som rigg/drift.

---

*Dokument opprettet: 2025-12-09*
*Sist oppdatert: 2025-12-09*
*Forfatter: Claude (LLM Assistant)*
*Status: ✅ Godkjent for implementering*
