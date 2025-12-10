# LLM-prompt: Trinnvis NS 8407 Datamodell-kontroll

**Formål:** Denne prompten guider en LLM gjennom systematisk kontroll av datamodeller mot NS 8407, én del om gangen for å unngå kontekstoverflyt.

---

## Instruksjoner til LLM

Du skal gjennomføre en grundig kontroll av datamodeller og skjemaer mot NS 8407 totalentreprisekontrakten. Kontrollen er delt opp i 9 deler (A-I) som skal utføres sekvensielt.

### Viktig: Trinnvis gjennomføring

**Planen er for stor til å leses i sin helhet.** Følg denne prosedyren:

1. Les kun den aktuelle delen av planen (én del per sesjon)
2. Les de relevante kodefilene for den delen
3. Utfør kontrollpunktene systematisk
4. Oppdater checklistene med [x] for fullført
5. Dokumenter eventuelle avvik
6. Når delen er ferdig: fortsett til neste del

### Startkommando

For å starte eller fortsette kontrollen, bruk følgende format:

```
Utfør NS 8407-kontroll Del [X]
```

Der [X] er bokstaven for delen (A-I).

---

## Del A: Grunnlag (Ansvarsgrunnlag)

### Før du starter Del A

1. Les planseksjonen:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/docs/NS8407_KONTROLLPLAN.md
   # Les fra "## Del A" til "## Del B"
   ```

2. Les relevante NS 8407-paragrafer:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/NS_8407.md
   # Fokuser på §31-34 (endringer og vederlag)
   ```

3. Les backend-modell:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/models/events.py
   # Fokus på GrunnlagData klassen (linje ~263-337)
   ```

4. Les frontend-skjema:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/components/actions/SendGrunnlagModal.tsx
   ```

5. Les kategorier:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/constants/categories.ts
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/constants/grunnlag_categories.py
   ```

### Kontrolloppgaver Del A

For hvert kontrollpunkt (A.2.1 - A.8.7):
1. Verifiser at implementasjonen matcher NS 8407-kravet
2. Kryss av [x] i planen hvis OK
3. Hvis avvik: noter i rapport

### Rapportering Del A

Når ferdig, opprett rapport med format:
```markdown
## Del A Kontrollrapport

**Dato:** [dato]
**Kontrollør:** LLM

### Godkjente kontrollpunkter
- A.2.1: [beskrivelse]
- A.2.2: [beskrivelse]
...

### Avvik funnet
| # | Beskrivelse | NS 8407 ref | Forslag til løsning |
|---|-------------|-------------|---------------------|
| 1 | [avvik] | §[ref] | [løsning] |

### Neste steg
Fortsett med: `Utfør NS 8407-kontroll Del B`
```

---

## Del B: Vederlagsjustering

### Før du starter Del B

1. Les planseksjonen:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/docs/NS8407_KONTROLLPLAN.md
   # Les fra "## Del B" til "## Del C"
   ```

2. Les relevante NS 8407-paragrafer:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/NS_8407.md
   # Fokuser på §30 (regningsarbeid) og §34 (vederlagsjustering)
   ```

3. Les backend-modell:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/models/events.py
   # Fokus på VederlagData klassen (linje ~342-457)
   ```

4. Les frontend-skjema:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/components/actions/SendVederlagModal.tsx
   ```

5. Les konstanter:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/constants/paymentMethods.ts
   ```

### Kontrolloppgaver Del B

Utfør kontrollpunktene B.2.1 - B.7.8 systematisk.

**Spesiell fokus:**
- §34.1.3 særskilte krav (rigg/produktivitet)
- 7-dagers varselfrist
- Vederlagsmetoder (EP, regning, fastpris)

---

## Del C: Fristforlengelse

### Før du starter Del C

1. Les planseksjonen:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/docs/NS8407_KONTROLLPLAN.md
   # Les fra "## Del C" til "## Del D"
   ```

2. Les relevante NS 8407-paragrafer:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/NS_8407.md
   # Fokuser på §33 (fristforlengelse)
   ```

3. Les backend-modell:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/models/events.py
   # Fokus på FristData klassen (linje ~462-573)
   ```

4. Les frontend-skjema:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/components/actions/SendFristModal.tsx
   ```

5. Les konstanter:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/constants/fristVarselTypes.ts
   ```

### Kontrolloppgaver Del C

Utfør kontrollpunktene C.2.1 - C.7.8 systematisk.

**Spesiell fokus:**
- §33.4 nøytralt varsel
- §33.6 spesifisert krav
- §33.6.2 BH etterlysning (kritisk)
- §33.8 forsering

---

## Del D: BH-respons Grunnlag

### Før du starter Del D

1. Les planseksjonen (Del D)

2. Les relevante NS 8407-paragrafer:
   - §32.3 (BH svarplikt)
   - §25.3 (svar på svikt-varsel)

3. Les backend-modell:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/models/events.py
   # Fokus på GrunnlagResponsData (linje ~589-626)
   ```

4. Les frontend-skjema:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/components/actions/RespondGrunnlagModal.tsx
   ```

5. Les responsalternativer:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/constants/responseOptions.ts
   ```

---

## Del E: BH-respons Vederlag

### Før du starter Del E

1. Les planseksjonen (Del E)

2. Les relevante NS 8407-paragrafer:
   - §34.3.3 (svarplikt EP-justering)
   - §30.2 (hold tilbake)

3. Les backend-modell:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/models/events.py
   # Fokus på VederlagResponsData (linje ~629-709)
   ```

4. Les frontend-skjema:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/components/actions/RespondVederlagModal.tsx
   ```

**VIKTIG:** Vederlagsrespons er REN beregning. Verifiser at det IKKE finnes "avvist grunnlag"-alternativ her.

---

## Del F: BH-respons Frist

### Før du starter Del F

1. Les planseksjonen (Del F)

2. Les relevante NS 8407-paragrafer:
   - §33.7 (svarplikt fristkrav)
   - §33.8 (forsering)

3. Les backend-modell:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/models/events.py
   # Fokus på FristResponsData (linje ~712-824)
   ```

4. Les frontend-skjema:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/components/actions/RespondFristModal.tsx
   ```

**VIKTIG:** Fristrespons er REN tidsberegning. Verifiser port-modell (preklusjon → vilkår → beregning).

---

## Del G: Varslingsregler og preklusjon

### Før du starter Del G

1. Les planseksjonen (Del G)

2. Les relevante NS 8407-paragrafer:
   - §5 (varsler og krav)
   - §32.2, §32.3 (irregulær endring varsling)
   - §33.4, §33.6, §33.7 (frist varsling)
   - §34.1.2, §34.1.3, §34.3.3 (vederlag varsling)

3. Les varslingsregler:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/constants/varslingsregler.ts
   ```

4. Gå gjennom alle modaler og verifiser at preklusjonsvarsler vises korrekt:
   - SendGrunnlagModal
   - SendVederlagModal
   - SendFristModal
   - RespondGrunnlagModal
   - RespondVederlagModal
   - RespondFristModal

---

## Del H: Kategorier og underkategorier

### Før du starter Del H

1. Les planseksjonen (Del H)

2. Sammenlign frontend og backend kategorier:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/src/constants/categories.ts
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/constants/grunnlag_categories.py
   ```

3. Verifiser at alle hjemmelreferanser er korrekte mot NS 8407

4. Sjekk synkronisering mellom frontend/backend

---

## Del I: Endringsordre og EO

### Før du starter Del I

1. Les planseksjonen (Del I)

2. Les relevante NS 8407-paragrafer:
   - §31 (endringer)
   - §31.3 (endringsordre)

3. Les backend-modell:
   ```
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/models/events.py
   # Fokus på EOUtstedtEvent
   Read /Users/kasper/Projects/Catenda/unified-timeline/backend/models/sak_state.py
   # Fokus på kan_utstede_eo logikk
   ```

---

## Sluttrapport

Når alle deler (A-I) er fullført, opprett en samlet sluttrapport:

```markdown
# NS 8407 Kontroll - Sluttrapport

**Dato:** [dato]
**Totalt kontrollpunkter:** 218

## Oppsummering

| Del | Kontrollpunkter | Godkjent | Avvik |
|-----|-----------------|----------|-------|
| A | 45 | X | Y |
| B | 32 | X | Y |
| C | 32 | X | Y |
| D | 18 | X | Y |
| E | 24 | X | Y |
| F | 22 | X | Y |
| G | 24 | X | Y |
| H | 13 | X | Y |
| I | 8 | X | Y |
| **Totalt** | **218** | **X** | **Y** |

## Kritiske avvik (må fikses)

[Liste over kritiske avvik]

## Moderate avvik (bør fikses)

[Liste over moderate avvik]

## Mindre avvik (valgfritt)

[Liste over mindre avvik]

## Konklusjon

[Samlet vurdering]
```

---

## Hurtigreferanse: Filplasseringer

| Fil | Innhold |
|-----|---------|
| `NS_8407.md` | Fullstendig NS 8407 tekst |
| `backend/models/events.py` | Alle event-datamodeller |
| `backend/models/sak_state.py` | Aggregert tilstand |
| `backend/constants/grunnlag_categories.py` | Backend kategorier |
| `src/components/actions/Send*.tsx` | TE skjemaer |
| `src/components/actions/Respond*.tsx` | BH skjemaer |
| `src/constants/categories.ts` | Frontend kategorier |
| `src/constants/responseOptions.ts` | BH responsalternativer |
| `src/constants/paymentMethods.ts` | Vederlagsmetoder |
| `src/constants/fristVarselTypes.ts` | Frist varseltyper |
| `src/constants/varslingsregler.ts` | Varslingsregler |
| `src/types/timeline.ts` | Frontend typer |

---

## Tips til effektiv kontroll

1. **Les NS 8407 først** - forstå hva standarden krever
2. **Fokuser på én del om gangen** - unngå kontekstoverflyt
3. **Bruk Grep for å søke** - finn spesifikke referanser raskt
4. **Dokumenter underveis** - ikke vent til slutten
5. **Vær grundig** - dette er juridisk bindende kontraktsvilkår

---

*Prompt versjon: 1.0 | Opprettet: 2025-12-08*
