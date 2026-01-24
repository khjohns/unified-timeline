# UX-mønster: Varslingsveiledning

**Progressiv avsløring av varslingsregler i modaler**

*Sist oppdatert: 2026-01-24*

---

## Bakgrunn

NS 8407 har komplekse varslingsregler med fem dimensjoner som må kommuniseres til brukeren:

1. **Hvem** - Entreprenøren eller Byggherren
2. **Trigger** - Hva utløser varslingsplikten
3. **Skjæringstidspunkt** - Når fristen begynner å løpe
4. **Frist** - Hvor lang tid (typisk "uten ugrunnet opphold")
5. **Konsekvens** - Hva skjer ved brudd

Utfordringen er å formidle denne informasjonen uten å overvelde brukeren.

---

## Designprinsipper

### Unngå alert-fatigue

Alerts bør reserveres for **kritiske påminnelser**, ikke generell veiledning. Overbruk av alerts fører til at brukeren ignorerer dem.

### Progressiv avsløring

Vis informasjon i lag - det essensielle først, detaljer ved behov eller etter valg.

### Kontekstuell plassering

Varslingsveiledning integreres i eksisterende steg, knyttet til den aktuelle seksjonen der brukeren tar stilling til varsel/krav.

---

## 3-nivå modell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VARSLINGSVEILEDNING - 3 NIVÅER                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NIVÅ 1: SPØRSMÅL                                                          │
│  ─────────────────                                                         │
│  Alltid synlig. Selve valget brukeren må ta.                               │
│                                                                             │
│  NIVÅ 2: INLINE KONTEKST                                                   │
│  ───────────────────────                                                   │
│  Alltid synlig, subtil tekst under spørsmålet.                             │
│  Dekker: Hvem + Trigger + Skjæringstidspunkt + Frist                       │
│  (4 av 5 dimensjoner - kompakt formulert)                                  │
│                                                                             │
│  NIVÅ 3: ACCORDION                                                         │
│  ─────────────────                                                         │
│  Vises etter valg. Åpnes automatisk ved valg som utløser konsekvens.       │
│  Dekker: Konsekvenser for Entreprenøren OG Byggherren                      │
│                                                                             │
│  ALERT (kun kritiske tilfeller)                                            │
│  ──────────────────────────────                                            │
│  §5-påminnelse, preklusjonsfare der bruker er i ferd med å tape            │
│  rettigheter, fristadvarsler.                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Eksempler

### Eksempel 1: Byggherren vurderer grunnlagsvarsel (§32.2)

**FØR VALG:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Kom varselet i tide?                                    ○ Ja    ○ Nei      │
│                                                                             │
│  Entreprenøren skal varsle uten ugrunnet opphold etter å ha mottatt        │
│  pålegget (§32.2).                                                         │
│                                                                             │
│  ▸ Se konsekvenser                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**ETTER VALG "JA":**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Kom varselet i tide?                                    ● Ja    ○ Nei      │
│                                                                             │
│  Entreprenøren skal varsle uten ugrunnet opphold etter å ha mottatt        │
│  pålegget (§32.2).                                                         │
│                                                                             │
│  ▸ Se konsekvenser                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**ETTER VALG "NEI":**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Kom varselet i tide?                                    ○ Ja    ● Nei      │
│                                                                             │
│  Entreprenøren skal varsle uten ugrunnet opphold etter å ha mottatt        │
│  pålegget (§32.2).                                                         │
│                                                                             │
│  ▾ Konsekvenser                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                    │    │
│  │  Entreprenøren:  Taper retten til å påberope at forholdet         │    │
│  │                  er en endring.                                    │    │
│  │                                                                    │    │
│  │  Byggherren:     Du må påberope dette skriftlig nå (§5).          │    │
│  │                  Gjør du ikke det, anses varselet gitt i tide.    │    │
│  │                                                                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ⚠️ Innsigelsen må fremsettes skriftlig i denne responsen (§5)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Eksempel 2: Byggherren vurderer vederlagsvarsel ved SVIKT (§34.1.2)

**ETTER VALG "NEI":**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Kom vederlagsvarselet i tide?                           ○ Ja    ● Nei      │
│                                                                             │
│  Entreprenøren skal varsle uten ugrunnet opphold etter at han ble          │
│  eller burde blitt klar over forholdet (§34.1.2).                          │
│                                                                             │
│  ▾ Konsekvenser                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                    │    │
│  │  Entreprenøren:  Kravet på vederlagsjustering tapes.              │    │
│  │                                                                    │    │
│  │  Byggherren:     Du må påberope dette skriftlig nå (§5).          │    │
│  │                  Gjør du ikke det, anses varselet gitt i tide.    │    │
│  │                                                                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ⚠️ Innsigelsen må fremsettes skriftlig i denne responsen (§5)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Eksempel 3: Entreprenøren vurderer Byggherrens svar (§33.7)

**ETTER VALG "NEI":**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Kom svaret i tide?                                      ○ Ja    ● Nei      │
│                                                                             │
│  Byggherren skal svare uten ugrunnet opphold etter å ha mottatt            │
│  spesifisert krav (§33.7).                                                 │
│                                                                             │
│  ▾ Konsekvenser                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                    │    │
│  │  Byggherren:     Innsigelser mot kravet tapes.                    │    │
│  │                                                                    │    │
│  │  Entreprenøren:  Du må påberope dette skriftlig nå (§5).          │    │
│  │                  Gjør du ikke det, anses svaret gitt i tide.      │    │
│  │                                                                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ⚠️ Innsigelsen må fremsettes skriftlig i denne responsen (§5)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Foreslått komponent

### Props

```typescript
interface VarslingsVeiledningProps {
  /** Paragraf-referanse, f.eks. "§32.2" */
  hjemmel: string;

  /** Spørsmålet som vises til brukeren */
  sporsmal: string;

  /**
   * Inline kontekst - dekker hvem, trigger, skjæringstidspunkt, frist.
   * Vises alltid under spørsmålet.
   */
  inlineKontekst: string;

  /** Konsekvens for Entreprenøren ved brudd */
  konsekvensEntreprenor: string;

  /** Konsekvens/påminnelse for Byggherren (typisk §5) */
  konsekvensByggherre: string;

  /** Nåværende valg (null = ikke valgt ennå) */
  valg: boolean | null;

  /** Callback når bruker endrer valg */
  onValgEndring: (valg: boolean) => void;

  /**
   * Valgfri: Vis kritisk alert (kun for spesielle tilfeller).
   * Vises kun når valg === false.
   */
  kritiskAlert?: string;
}
```

### Brukseksempel

```tsx
<VarslingsVeiledning
  hjemmel="§32.2"
  sporsmal="Kom varselet i tide?"
  inlineKontekst="Entreprenøren skal varsle uten ugrunnet opphold etter å ha mottatt pålegget"
  konsekvensEntreprenor="Taper retten til å påberope at forholdet er en endring."
  konsekvensByggherre="Du må påberope dette skriftlig nå (§5). Gjør du ikke det, anses varselet gitt i tide."
  valg={varselITide}
  onValgEndring={setVarselITide}
  kritiskAlert="Innsigelsen må fremsettes skriftlig i denne responsen (§5)"
/>
```

### Oppførsel

| Tilstand | Nivå 1 | Nivå 2 | Nivå 3 | Alert |
|----------|--------|--------|--------|-------|
| Før valg | Synlig | Synlig | Lukket (klikkbar) | Skjult |
| Etter "Ja" | Synlig | Synlig | Lukket (klikkbar) | Skjult |
| Etter "Nei" | Synlig | Synlig | **Åpen** (auto) | **Synlig** |

---

## Varianter per spor

### Grunnlagssporet

| Kategori | Hjemmel | Inline kontekst | Konsekvens Entreprenør |
|----------|---------|-----------------|------------------------|
| ENDRING | §32.2 | "...etter å ha mottatt pålegget" | Taper retten til å påberope endring |
| SVIKT/ANDRE | §25.1.2 | "...etter at han ble eller burde blitt oppmerksom på forholdet" | Byggherren kan kreve erstatning |

### Vederlagssporet

| Kategori | Hjemmel | Inline kontekst | Konsekvens Entreprenør |
|----------|---------|-----------------|------------------------|
| ENDRING | §34.1.1 | *Ikke relevant - ingen preklusjon* | - |
| SVIKT/ANDRE | §34.1.2 | "...etter at han ble eller burde blitt klar over forholdet" | Kravet på vederlagsjustering tapes |
| Rigg/drift | §34.1.3 | "...etter at han ble eller burde blitt klar over at utgifter ville påløpe" | Retten til påløpte utgifter tapes |
| Produktivitet | §34.1.3 | "...etter at han ble eller burde blitt klar over at utgifter ville påløpe" | Retten til påløpte utgifter tapes |

### Fristsporet

| Type | Hjemmel | Inline kontekst | Konsekvens Entreprenør |
|------|---------|-----------------|------------------------|
| Nøytralt varsel | §33.4 | "...uten ugrunnet opphold" | Kravet på fristforlengelse tapes |
| Spesifisert krav | §33.6.1 | "...etter at han har grunnlag for å beregne omfanget" | Kun krav på det Byggherren måtte forstå |
| Svar på etterlysning | §33.6.2 | "...etter å ha mottatt etterlysningen" | Kravet på fristforlengelse tapes |

---

## Plassering i modaler

Komponenten integreres i **eksisterende steg**, ikke som eget steg. Den plasseres:

1. **I seksjonen der brukeren tar stilling til varselet/kravet**
2. **Før andre valg som avhenger av varslingsvurderingen**
3. **Etter eventuell kontekst om hva som ble varslet**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EKSEMPEL: RespondGrunnlagModal                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Eksisterende: Kontekst om saken]                                         │
│                                                                             │
│  ──────────────────────────────────────────────────                        │
│                                                                             │
│  [NY: VarslingsVeiledning - integrert her]                                 │
│                                                                             │
│  ──────────────────────────────────────────────────                        │
│                                                                             │
│  [Eksisterende: Resultat-valg (godkjent/delvis/avslått)]                   │
│                                                                             │
│  [Eksisterende: Begrunnelse]                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Når bruke alert

Alerts reserveres for:

| Situasjon | Alert-tekst |
|-----------|-------------|
| §5-påminnelse (ved "Nei") | "Innsigelsen må fremsettes skriftlig i denne responsen (§5)" |
| Preklusjonsfare (tid) | "Det er gått X dager siden mottak" |
| Kritisk frist | "Svar raskt for å unngå tap av innsigelsesrett" |

Alerts skal **ikke** brukes for:
- Generell veiledning (bruk inline kontekst)
- Hjemmel-referanser (bruk accordion)
- Informasjon som alltid gjelder (bruk inline kontekst)

---

## Relasjon til andre dokumenter

- **NS8407_VARSLINGSREGLER.md**: Komplett referanse for varslingsreglene som ligger til grunn
- **begrunnelseGenerator.ts**: Genererer begrunnelsestekst basert på valg i komponenten
- **.claude/skills/ns8407/SKILL.md**: Kontraktsreferanser

---

> **Dokumenthistorikk:**
> - 2026-01-24: Opprettet basert på drøfting av UX for varslingsveiledning
