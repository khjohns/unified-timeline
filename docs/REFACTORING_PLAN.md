# Refaktoreringsplan - Frontend

**Opprettet:** 2024-12-24
**Status:** Pågående arbeid

---

## Innhold

1. [Oppsummering](#1-oppsummering)
2. [Fullførte tiltak](#2-fullførte-tiltak)
3. [Gjenstående arbeid](#3-gjenstående-arbeid)
4. [Implementeringsrekkefølge](#4-implementeringsrekkefølge)

---

## 1. Oppsummering

Denne planen beskriver gjenstående refaktoreringsarbeid identifisert under en kodekvalitetsgjennomgang av frontend-koden.

### Nøkkeltall

| Kategori | Status |
|----------|--------|
| Duplisert kode fjernet | ~200 linjer |
| Nye sentraliserte moduler | 3 filer |
| Sider refaktorert | 5 sider |
| Gjenstående store modaler | 5 komponenter |

---

## 2. Fullførte tiltak

### 2.1 Sentraliserte hjelpefunksjoner (Fullført)

**Opprettet:**

| Fil | Formål |
|-----|--------|
| `src/components/PageStateHelpers.tsx` | Felles loading/error/auth-komponenter |
| `src/utils/formatters.ts` | Sentraliserte formatters (currency, days, dates) |
| `src/constants/statusStyles.ts` | Status-til-CSS mapping |

**Refaktorerte sider:**

- `SaksoversiktPage.tsx` - Bruker nå felles formatters og status-styling
- `CasePage.tsx` - Bruker `VerifyingState`, `AuthErrorState`, `LoadingState`, `ErrorState`
- `ForseringPage.tsx` - Samme mønster
- `EndringsordePage.tsx` - Samme mønster
- `CaseDashboard.tsx` - Bruker felles formatters og `getSporStatusStyle`

---

## 3. Gjenstående arbeid

### 3.1 Kritisk: Splitt store modaler

De største modalene i kodebasen er for komplekse og bør deles opp:

| Modal | Linjer | Problem | Anbefalt løsning |
|-------|--------|---------|------------------|
| `RespondVederlagModal.tsx` | 1906 | 10x normalt, 78+ useForm-kall | Splitt i 3 sub-komponenter |
| `RespondFristModal.tsx` | 1462 | Dupliserer mye logikk fra vederlag | Splitt i 2 sub-komponenter |
| `EventDetailModal.tsx` | 1211 | Alle event-typer i én fil | Splitt per event-type |
| `UtstEndringsordreModal.tsx` | 984 | Kompleks logikk | Vurder sub-modaler |
| `CasePage.tsx` | 707 | 14+ modal-state variabler | Bruk modal-manager pattern |

#### 3.1.1 RespondVederlagModal (Høyest prioritet)

**Nåværende struktur:**
- 865 linjer faktisk kode
- 84KB filstørrelse
- ~100+ conditional render statements

**Foreslått oppdeling:**

```
src/components/actions/respond-vederlag/
├── RespondVederlagModal.tsx       # Hovedmodal (koordinator)
├── BelopVurderingSection.tsx      # Beløp-vurdering form
├── MetodeVurderingSection.tsx     # Metode-aksept/avslag
├── PreklusjonSection.tsx          # Preklusjons-håndtering
└── types.ts                       # Delte typer
```

**Estimat:** 4-6 timer

#### 3.1.2 RespondFristModal

**Foreslått oppdeling:**

```
src/components/actions/respond-frist/
├── RespondFristModal.tsx          # Hovedmodal
├── DagerVurderingSection.tsx      # Dager-vurdering
├── VarselTypeSection.tsx          # Varseltype-håndtering
└── types.ts
```

**Estimat:** 3-4 timer

#### 3.1.3 EventDetailModal

**Foreslått oppdeling:**

```
src/components/views/event-detail/
├── EventDetailModal.tsx           # Hovedmodal med routing
├── GrunnlagEventDetail.tsx        # Grunnlag-spesifikk visning
├── VederlagEventDetail.tsx        # Vederlag-spesifikk visning
├── FristEventDetail.tsx           # Frist-spesifikk visning
├── ResponseEventDetail.tsx        # Respons-spesifikk visning
└── types.ts
```

**Estimat:** 4-5 timer

---

### 3.2 Medium prioritet: Modal-state management i CasePage

**Problem:**
`CasePage.tsx` har 14+ useState-kall for modal-tilstander:

```tsx
const [sendGrunnlagOpen, setSendGrunnlagOpen] = useState(false);
const [sendVederlagOpen, setSendVederlagOpen] = useState(false);
const [sendFristOpen, setSendFristOpen] = useState(false);
const [respondGrunnlagOpen, setRespondGrunnlagOpen] = useState(false);
// ... 10+ flere
```

**Foreslått løsning - Modal Manager Hook:**

```tsx
// src/hooks/useModalManager.ts
type ModalType =
  | 'sendGrunnlag'
  | 'sendVederlag'
  | 'respondGrunnlag'
  // ...etc

interface ModalState {
  activeModal: ModalType | null;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  isOpen: (modal: ModalType) => boolean;
}

export function useModalManager(): ModalState {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);

  return {
    activeModal,
    openModal: setActiveModal,
    closeModal: () => setActiveModal(null),
    isOpen: (modal) => activeModal === modal,
  };
}
```

**Bruk:**
```tsx
const modals = useModalManager();

// I stedet for 14 useState-kall:
<Button onClick={() => modals.openModal('sendGrunnlag')}>
  Send grunnlag
</Button>

<SendGrunnlagModal
  open={modals.isOpen('sendGrunnlag')}
  onOpenChange={() => modals.closeModal()}
/>
```

**Estimat:** 2-3 timer

---

### 3.3 Medium prioritet: Generaliser lokale hooks

**Problem:**
Nesten identiske hooks definert lokalt i flere sider:

```tsx
// ForseringPage.tsx
function useForseringKontekst(sakId: string, enabled: boolean = true) {
  return useQuery<ForseringKontekstResponse, Error>({
    queryKey: ['forsering', sakId, 'kontekst'],
    queryFn: () => fetchForseringKontekst(sakId),
    staleTime: STALE_TIME.DEFAULT,
    enabled: !!sakId && enabled,
  });
}

// EndringsordePage.tsx - NESTEN IDENTISK
function useEOKontekst(sakId: string, enabled: boolean = true) {
  return useQuery<EOKontekstResponse, Error>({
    queryKey: ['endringsordre', sakId, 'kontekst'],
    queryFn: () => fetchEOKontekst(sakId),
    staleTime: STALE_TIME.DEFAULT,
    enabled: !!sakId && enabled,
  });
}
```

**Foreslått løsning:**

Flytt til `src/hooks/`:

```tsx
// src/hooks/useForseringKontekst.ts
export function useForseringKontekst(sakId: string, enabled = true) { ... }

// src/hooks/useEOKontekst.ts
export function useEOKontekst(sakId: string, enabled = true) { ... }
```

**Estimat:** 1-2 timer

---

### 3.4 Lav prioritet: Sentraliser empty states

**Problem:**
Empty state-konstanter definert lokalt i flere sider:

```tsx
// CasePage.tsx
const EMPTY_STATE: SakState = { ... }

// ForseringPage.tsx
const EMPTY_FORSERING_DATA: ForseringData = { ... }

// EndringsordePage.tsx
const EMPTY_EO_DATA: EndringsordreData = { ... }
```

**Foreslått løsning:**

```tsx
// src/constants/emptyStates.ts
export const EMPTY_SAK_STATE: SakState = { ... }
export const EMPTY_FORSERING_DATA: ForseringData = { ... }
export const EMPTY_EO_DATA: EndringsordreData = { ... }
```

**Estimat:** 1 time

---

### 3.5 Lav prioritet: Fiks TODOs i kodebasen

Identifiserte TODOs som bør adresseres:

| Fil | Linje | TODO |
|-----|-------|------|
| `CasePage.tsx` | 690 | `dagmulktsats={50000} // TODO: Get from contract config` |
| `EndringsordePage.tsx` | 380 | `{/* TODO: Implement modals for aksepter, bestrid, revider */}` |

**Estimat:** Varierende, avhenger av kompleksitet

---

## 4. Implementeringsrekkefølge

### Fase 1: Kritisk (Før neste release)

| Oppgave | Estimat | Prioritet |
|---------|---------|-----------|
| Splitt `RespondVederlagModal.tsx` | 4-6 timer | Høy |
| Splitt `RespondFristModal.tsx` | 3-4 timer | Høy |

### Fase 2: Høy prioritet (Neste sprint)

| Oppgave | Estimat | Prioritet |
|---------|---------|-----------|
| Splitt `EventDetailModal.tsx` | 4-5 timer | Høy |
| Implementer modal-manager hook | 2-3 timer | Medium |

### Fase 3: Medium prioritet (Nice-to-have)

| Oppgave | Estimat | Prioritet |
|---------|---------|-----------|
| Flytt lokale hooks til src/hooks/ | 1-2 timer | Medium |
| Sentraliser empty states | 1 time | Lav |
| Fiks TODOs | Varierende | Lav |

---

## Estimert total innsats

| Fase | Estimat |
|------|---------|
| Fase 1 | 7-10 timer |
| Fase 2 | 6-8 timer |
| Fase 3 | 3-4 timer |
| **Total** | **16-22 timer** |

---

## Relaterte dokumenter

- [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) - Overordnet arkitektur
- [FRONTEND_IMPROVEMENTS.md](./FRONTEND_IMPROVEMENTS.md) - Andre forbedringer (ErrorBoundary, lazy loading, etc.)
