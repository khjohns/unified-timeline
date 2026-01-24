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

## Implementert komponent: VarslingsregelInline

> **Status:** ✅ Implementert 2026-01-24

### Fil
`src/components/shared/VarslingsregelInline.tsx`

### Props

```typescript
interface VarslingsregelInlineProps {
  /** Paragraf-referanse */
  hjemmel: '§33.4' | '§33.6.1' | '§33.6.2' | '§33.7' | '§33.8';
}
```

### Brukseksempel

```tsx
<VarslingsregelInline hjemmel="§33.4" />
```

### Design

Komponenten bruker progressiv avsløring:

1. **Inline tekst (alltid synlig):** Hvem + frist + trigger
2. **Accordion (lukket som standard):** Konsekvenser + §5-mekanisme

### Eksempel: §33.4 Varsel om fristforlengelse

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Totalentreprenøren skal varsle «uten ugrunnet opphold» etter at forholdet │
│  oppstår, selv om han ennå ikke kan fremsette et spesifisert krav.         │
│                                                                             │
│  ▸ Vis konsekvenser                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Når accordion åpnes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ▾ Konsekvenser                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                    │    │
│  │  Konsekvens: Krav på fristforlengelse tapes dersom det ikke       │    │
│  │              varsles innen fristen.                                │    │
│  │                                                                    │    │
│  │  §5: Byggherren må påberope senhet skriftlig «uten ugrunnet       │    │
│  │      opphold» etter mottak – ellers anses varselet gitt i tide.   │    │
│  │                                                                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Støttede hjemler

| Hjemmel | Hvem | Inline tekst |
|---------|------|--------------|
| §33.4 | TE | Skal varsle «uten ugrunnet opphold» etter at forholdet oppstår |
| §33.6.1 | TE | Skal angi og begrunne antall dager «uten ugrunnet opphold» |
| §33.6.2 | TE | Skal svare på forespørselen «uten ugrunnet opphold» |
| §33.7 | BH | Skal svare «uten ugrunnet opphold» på spesifisert krav |
| §33.8 | TE | Skal varsle forseringskrav «uten ugrunnet opphold» etter avslag |

### Rolleagnostisk

Komponenten bruker tredjepersons kontraktstekst ("Totalentreprenøren skal...", "Byggherren skal...") og er dermed uavhengig av hvilken part som leser den.

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
| Varsel om fristforlengelse | §33.4 | "...uten ugrunnet opphold etter at forholdet oppstår" | Kravet på fristforlengelse tapes |
| Spesifisert krav | §33.6.1 | "...uten ugrunnet opphold etter at han har grunnlag for å beregne" | Kun krav på det Byggherren måtte forstå |
| Svar på forespørsel | §33.6.2 | "...uten ugrunnet opphold etter forespørselen" | Kravet på fristforlengelse tapes |
| Byggherrens svarplikt | §33.7 | "...uten ugrunnet opphold etter mottatt krav" | Innsigelser mot kravet tapes |
| Forsering | §33.8 | "...uten ugrunnet opphold etter avslag" | Retten til forseringskrav tapes |

**Merk:** Når TE sender kun spesifisert krav (uten forutgående varsel), må BH vurdere BÅDE §33.4 og §33.6.1.

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
