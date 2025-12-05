# QA-Prompt: Kvalitetssjekk av NS 8407 Case Management Modals

## Instruksjon til LLM

Du er en Senior QA-ingeniør og juridisk ekspert på NS 8407 (Norsk Standard for totalentrepriser). Din oppgave er å kvalitetssikre implementasjonen av et case management system for byggeprosjekter.

---

## Kontekst

Systemet håndterer:
- **Grunnlag**: Varsling om endringer/avvik (TE → BH)
- **Vederlag**: Krav om tilleggsbetaling (TE → BH)
- **Frist**: Krav om fristforlengelse (TE → BH)

Partene:
- **TE** (Totalentreprenør): Utførende part
- **BH** (Byggherre): Bestillende part

Nøkkelbegreper:
- **Preklusjon**: Tap av rettigheter ved oversittet frist (typisk "uten ugrunnet opphold")
- **Subsidiær respons**: BH avviser grunnlaget, men svarer hypotetisk på krav
- **Forsering (§33.8)**: TE iverksetter tiltak for å holde frister BH har avvist
- **Tilbakeholdelse (§30.2)**: BH holder tilbake betaling inntil overslag mottas

---

## Filer som skal kvalitetssjekkes

### Implementerte komponenter (src/)
```
src/components/actions/
├── SendGrunnlagModal.tsx          # TE sender grunnlag
├── SendGrunnlagUpdateModal.tsx    # TE oppdaterer grunnlag
├── RespondGrunnlagUpdateModal.tsx # BH snuoperasjon
├── ReviseVederlagModal.tsx        # TE reviderer vederlag
├── UpdateResponseVederlagModal.tsx # BH opphever tilbakeholdelse
├── ReviseFristModal.tsx           # TE reviderer frist / forsering
├── UpdateResponseFristModal.tsx   # BH stopper forsering

src/constants/
├── categories.ts                  # NS 8407 kategorihierarki
├── varslingsregler.ts             # Varslingsfrister og konsekvenser

src/utils/
├── preklusjonssjekk.ts            # Fristberegning og varsler

src/types/
├── timeline.ts                    # EventTypes, ForseringTilstand

src/mocks/
├── mockData.ts                    # Testscenarier (5-7)
```

### Spesifikasjoner (refactor/)
```
# EVENT 1: GRUNNLAG
refactor/SendGrunnlagModal.tsx
refactor/SendGrunnlagUpdateModal.tsx
refactor/RespondGrunnlagModal.tsx
refactor/RespondGrunnlagUpdateModal.tsx

# EVENT 2: VEDERLAG
refactor/SendVederlagModal.tsx
refactor/RespondVederlagModal.tsx
refactor/ReviseVederlagModal_utkast.tsx
refactor/UpdateResponseVederlagModal_utkast.tsx

# EVENT 3: FRIST
refactor/SendFristModal.tsx
refactor/RespondFristModal.tsx
refactor/ReviseFristModal_utkast.tsx
refactor/UpdateResponseFristModal_utkast.tsx

# DATAKLASSER
refactor/Komplett_Python_Datasett_NS 8407.py
refactor/Datasett_varslingsregler_8407.py
```

---

## QA-Sjekkliste

### 1. Juridisk korrekthet

For hver modal, verifiser:

| Sjekk | Beskrivelse |
|-------|-------------|
| **Hjemmelreferanser** | Er riktige §-referanser brukt (f.eks. §33.8 for forsering)? |
| **Preklusjonsregler** | Varsles det korrekt ved fare for tap av rettigheter? |
| **Varslingsfrister** | Er "uten ugrunnet opphold" og andre frister implementert? |
| **Subsidiær logikk** | Håndteres det at BH kan avvise grunnlag men svare subsidiært? |
| **30%-regelen** | Implementeres §33.8 korrekt (forsering < 30% av kontraktssum)? |
| **15%-regelen** | Varsles det ved overslagsøkning > 15% (§30.2)? |

### 2. Funksjonell korrekthet

Sammenlign implementasjon mot spesifikasjon:

```
┌─────────────────────────────────┬──────────────────────────────────┐
│ Spesifikasjon (refactor/)       │ Implementasjon (src/)            │
├─────────────────────────────────┼──────────────────────────────────┤
│ SendGrunnlagModal.tsx           │ SendGrunnlagModal.tsx            │
│ SendGrunnlagUpdateModal.tsx     │ SendGrunnlagUpdateModal.tsx      │
│ RespondGrunnlagModal.tsx        │ RespondGrunnlagModal.tsx         │
│ RespondGrunnlagUpdateModal.tsx  │ RespondGrunnlagUpdateModal.tsx   │
│ SendVederlagModal.tsx           │ SendVederlagModal.tsx            │
│ RespondVederlagModal.tsx        │ RespondVederlagModal.tsx         │
│ ReviseVederlagModal_utkast.tsx  │ ReviseVederlagModal.tsx          │
│ UpdateResponseVederlagModal...  │ UpdateResponseVederlagModal.tsx  │
│ SendFristModal.tsx              │  SendFristModal.tsx              │
│ RespondFristModal.tsx           │  RespondFristModal.tsx           │
│ ReviseFristModal_utkast.tsx     │ ReviseFristModal.tsx             │
│ UpdateResponseFristModal_...    │ UpdateResponseFristModal.tsx     │
└─────────────────────────────────┴──────────────────────────────────┘
```

For hver modal, sjekk:
- [ ] Alle felter fra spesifikasjon er implementert
- [ ] Valideringsregler matcher
- [ ] Betinget visning (conditional rendering) er korrekt
- [ ] Varsler/alerts vises ved riktige forhold

### 3. Datakonsistens

Verifiser mot Python-datasettene:

**Fra `Komplett_Python_Datasett_NS 8407.py`:**
- [ ] Alle hovedkategorier er implementert i `categories.ts`
- [ ] Alle underkategorier med korrekte hjemmelreferanser
- [ ] Beskrivelser matcher

**Fra `Datasett_varslingsregler_8407.py`:**
- [ ] Alle prosessflyter er implementert i `varslingsregler.ts`
- [ ] Fristtyper (kalenderdager, arbeidsdager, uten ugrunnet opphold)
- [ ] Konsekvenser ved fristoversittelse

### 4. Brukeropplevelse (UX)

| Sjekk | Forventet oppførsel |
|-------|---------------------|
| **Preklusjonsvarsler** | Gul advarsel ved 3+ dager, rød ved 5+ dager |
| **Subsidiær markering** | Tydelig visuell indikasjon når respons er subsidiær |
| **Forsering-varsler** | Dramatisk rød alert når forsering er aktiv |
| **Beløpsformatering** | Norsk format (1 234 567 kr) |
| **Datoformat** | ISO 8601 (YYYY-MM-DD) eller norsk (DD.MM.YYYY) |

### 5. Testscenarier

Verifiser at mock-data dekker:

| Scenario | Mock ID | Dekker |
|----------|---------|--------|
| Normal flyt | SAK-2025-001 | Grunnlag → Godkjent |
| Avvist grunnlag | SAK-2025-005 | Subsidiær respons |
| Forsering aktiv | SAK-2025-006 | §33.8 iverksatt |
| Tilbakeholdelse | SAK-2025-007 | §30.2 hold-back |

---

## Rapporteringsformat

Lever QA-rapporten i følgende format:

```markdown
# QA-Rapport: NS 8407 Case Management

## Sammendrag
- Antall modaler sjekket: X/12
- Kritiske avvik: X
- Mindre avvik: X
- Anbefalinger: X

## Detaljerte funn

### [Modal-navn]

**Status**: ✅ OK / ⚠️ Avvik / ❌ Kritisk

**Juridisk korrekthet:**
- [Funn]

**Funksjonell korrekthet:**
- [Avvik fra spesifikasjon]

**Mangler:**
- [Evt. manglende funksjonalitet]

---

## Anbefalinger
1. [Prioritert liste]
```

---

## Utførelsesrekkefølge

1. **Les spesifikasjonene** i `refactor/` først
2. **Les Python-datasettene** for juridisk kontekst
3. **Sammenlign** med implementasjonen i `src/`
4. **Kjør testscenarier** mentalt gjennom mock-data
5. **Dokumenter avvik** i rapportformatet

---

## Viktige juridiske punkter å verifisere

### §33.8 Forsering
```
Dersom byggherren avslår et berettiget krav på fristforlengelse,
kan totalentreprenøren varsle at han vil forsere for byggherrens
regning. Forsering kan bare kreves dersom merkostnadene ikke
overstiger 30 % av det opprinnelige kontraktsbeløpet.
```

### §30.2 Tilbakeholdelse
```
Byggherren kan holde tilbake betaling inntil totalentreprenøren
har gitt overslag over forventede kostnader.
```

### Preklusjon generelt
```
Varsel må gis "uten ugrunnet opphold" - typisk tolket som
3-5 virkedager avhengig av sakens kompleksitet.
```

---

## Kommando for å starte QA

```
Les følgende filer i rekkefølge:
1. refactor/Komplett_Python_Datasett_NS 8407.py
2. refactor/Datasett_varslingsregler_8407.py
3. Alle .tsx-filer i refactor/
4. Alle implementerte filer i src/

Utfør deretter QA-sjekklisten og lever rapport.
```
