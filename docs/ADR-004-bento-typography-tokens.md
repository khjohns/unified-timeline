# ADR-004: Bento Typography Token System

**Status:** Akseptert
**Dato:** 2026-02-16
**Beslutningstagere:** Utviklingsteam
**Kontekst:** Typografi-konsolidering for bento-kort i KOE-plattformen

---

## Sammendrag

Bento-kortene bruker et eget sett med typografi-tokens (CSS custom properties)
som mapper til semantiske roller. Kun `font-size` tokeniseres — vekt og farge
varierer etter kontekst innenfor samme tier.

---

## Kontekst

### Problemstilling

Bento-kortene (FristCard, VederlagCard, CaseMasterCard m.fl.) brukte 6+
forskjellige hardkodede pikselstørrelser (`text-[8px]` til `text-sm`) spredt
over ~16 komponenter. Dette skapte:

1. **Inkonsistens** — Samme semantiske rolle (f.eks. "key-value label") brukte
   ulike størrelser i ulike kort
2. **Vedlikeholdskostnad** — Størrelsesendringer krevde manuell oppdatering
   på 50+ steder
3. **Ingen skalerbarhet** — Umulig å tilby en tekststørrelse-toggle (liten/
   medium/stor) uten å refaktorere alt

### Audit-funn

Gjennomgang av alle bento-komponenter avdekket følgende mønster:

| Størrelse | Semantisk rolle | Antall forekomster |
|-----------|-----------------|-------------------|
| `text-[8px]`–`text-[9px]` | Mikro-badges (TE/BH, PREKLUDERT) | ~10 |
| `text-[10px]` | Kort-titler, seksjonheadere, KPI-labels, §-referanser | ~43 |
| `text-[11px]` | Key-value labels, statuslabels, historikk-oppsummeringer | ~30 |
| `text-xs` (12px) | Dataverdier (mono), brødtekst, CTA-tekst | ~25 |
| `text-sm` (14px) | KPI-tallverdier (mono, tabular-nums) | ~8 |
| `text-lg` (18px) | Master-kort sakstittel (utenfor token-systemet) | 1 |

---

## Beslutning

### 5 tokens + 1 ekskludert

| Token | CSS-variabel | Default | Rolle |
|-------|-------------|---------|-------|
| `text-bento-micro` | `--bento-text-micro` | 9px | Badges: TE/BH-rolle, PREKLUDERT |
| `text-bento-label` | `--bento-text-label` | 10px | Kort-titler, seksjonsheadere, KPI-labels, §-referanser (uppercase tracking-wide) |
| `text-bento-caption` | `--bento-text-caption` | 11px | Key-value labels, statuslabels, historikk, inline-kontroller |
| `text-bento-body` | `--bento-text-body` | 12px | Dataverdier (mono), brødtekst, CTA-tekst, editor-innhold |
| `text-bento-kpi` | `--bento-text-kpi` | 14px | KPI hero-tall: "7d", "4d", "57%" |
| *(ekskludert)* | — | 18px | Master-kort sakstittel — identitetselement, ikke del av token-systemet |

### Hva tokeniseres IKKE

- **Font-weight** — Varierer innenfor samme tier (f.eks. `--bento-text-label`
  er `font-medium` for kort-titler men `font-semibold` for seksjonsheadere)
- **Farge** — Varierer etter kontekst (muted, subtle, default, semantic)
- **Line-height** — Følger Tailwind-defaults

### Mapping-regler

```
text-[8px]  → text-bento-micro   (konsolidert opp fra 8px til 9px)
text-[9px]  → text-bento-micro
text-[10px] → text-bento-label
text-[11px] → text-bento-caption
text-xs     → text-bento-body    (kun i bento-komponenter)
text-sm     → text-bento-kpi     (kun KPI-verdier i bento-kort)
```

### Implementering

CSS custom properties i `:root` + Tailwind v4 `@utility`-direktiver:

```css
:root {
  --bento-text-micro: 9px;
  --bento-text-label: 10px;
  --bento-text-caption: 11px;
  --bento-text-body: 12px;
  --bento-text-kpi: 14px;
}

@utility text-bento-micro   { font-size: var(--bento-text-micro); }
@utility text-bento-label   { font-size: var(--bento-text-label); }
@utility text-bento-caption { font-size: var(--bento-text-caption); }
@utility text-bento-body    { font-size: var(--bento-text-body); }
@utility text-bento-kpi     { font-size: var(--bento-text-kpi); }
```

---

## Konsekvenser

### Positive

- **Konsistens** — Én kilde til sannhet for tekststørrelser i bento-kort
- **Vedlikehold** — Endre én variabel i stedet for 50+ className-attributter
- **Skalerbarhet** — Tekststørrelse-toggle (liten/medium/stor) blir trivielt
  å implementere ved å swappe CSS-variabelverdier
- **Lesbarhet** — `text-bento-label` kommuniserer intensjon bedre enn `text-[10px]`

### Negative

- **Læringsterskel** — Utviklere må kjenne token-navnene
- **Kun bento-scope** — Tokens gjelder ikke utenfor `src/components/bento/`

### Scope

Berørte filer (alle under `src/components/bento/`):

- `track-cards/FristCard.tsx`
- `track-cards/VederlagCard.tsx`
- `track-cards/TrackCTA.tsx`
- `track-cards/TrackHistory.tsx`
- `track-cards/StatusDot.tsx`
- `CaseMasterCard.tsx`
- `InlineYesNo.tsx`
- `InlineNumberInput.tsx`
- `InlineCurrencyInput.tsx`
- `KravLinje.tsx`
- `MethodCards.tsx`
- `VerdictCards.tsx`
- `BentoRespondVederlag.tsx`
- `BentoRespondFrist.tsx`
- `BentoRespondGrunnlag.tsx`

### Ikke berørt

- `text-lg`/`text-xl`/`text-2xl` utenfor bento-kort
- Klassiske CasePage-komponenter i `src/components/`
- Button-komponentens tekststørrelser (styrt av size-prop)
- Alert-komponentens tekst (eget system)
