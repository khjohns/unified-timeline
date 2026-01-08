# Plan: Godkjenningsflyt for BH-responser

**Status:** Planlegging
**Opprettet:** 2026-01-08
**Sist oppdatert:** 2026-01-08

---

## Innhold

1. [Sammendrag](#1-sammendrag)
2. [Nåværende tilstand](#2-nåværende-tilstand)
3. [Målbilde](#3-målbilde)
4. [Teknisk design](#4-teknisk-design)
5. [Implementasjonsplan](#5-implementasjonsplan)
6. [Estimat](#6-estimat)
7. [Avhengigheter](#7-avhengigheter)
8. [Risiko](#8-risiko)

---

## 1. Sammendrag

### Hva

Implementere en hierarkisk godkjenningsflyt for BH-responser basert på beløpsgrenser. Når BH (Byggherre) skal sende respons på et krav, må responsen godkjennes av ledere i hierarkiet basert på samlet beløp.

### Hvorfor

- Internkontroll: Sikre at store økonomiske beslutninger godkjennes av riktig nivå
- Compliance: Følge organisasjonens fullmaktsmatrise
- Sporbarhet: Full audit trail på hvem som godkjente hva

### Beløpsgrenser (fra frontend-mock)

| Beløp | Påkrevde godkjennere |
|-------|---------------------|
| 0 – 500.000 kr | PL (Prosjektleder) |
| 500.001 – 2.000.000 kr | PL → SL (Seksjonsleder) |
| 2.000.001 – 5.000.000 kr | PL → SL → AL (Avdelingsleder) |
| 5.000.001 – 10.000.000 kr | PL → SL → AL → DU (Direktør utbygging) |
| Over 10.000.000 kr | PL → SL → AL → DU → AD (Adm. direktør) |

---

## 2. Nåværende tilstand

### Frontend (mock-implementasjon)

| Fil | Linjer | Beskrivelse |
|-----|--------|-------------|
| `src/context/ApprovalContext.tsx` | ~360 | localStorage-basert state management |
| `src/constants/approvalConfig.ts` | ~230 | Beløpsgrenser, mock-organisasjon |
| `src/types/approval.ts` | ~80 | TypeScript-typer |
| `src/components/approval/` | 6 stk | UI-komponenter |

**Begrensninger:**
- Kun localStorage (ingen persistens på tvers av enheter)
- Hardkodet mock-organisasjon (ikke koblet til Entra ID)
- Ingen backend-validering av godkjenninger

### Backend (ingenting)

Det finnes **ingen** backend-støtte for godkjenningsflyt:
- Ingen API-endepunkter
- Ingen database-tabeller
- Ingen event-typer for godkjenning
- Ingen Entra ID-integrasjon

### Eksisterende event-typer (fra openapi.yaml)

```
respons_grunnlag, respons_grunnlag_oppdatert
respons_vederlag, respons_vederlag_oppdatert
respons_frist, respons_frist_oppdatert
```

Disse event-typene sendes **direkte** uten godkjenningsflyt.

---

## 3. Målbilde

### Flyt

```
┌─────────────────────────────────────────────────────────────────────┐
│  BH (Saksbehandler) utarbeider respons                              │
│  - Fyller ut grunnlag/vederlag/frist-responser                      │
│  - Lagres som utkast i ApprovalContext                              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BH sender til godkjenning                                          │
│  - Oppretter BhResponsPakke med samlet beløp                        │
│  - Backend: approval_pakke_opprettet event                          │
│  - Beregner påkrevde godkjennere basert på beløp                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Hierarkisk godkjenning                                             │
│  - Første godkjenner (PL) får varsel                                │
│  - Backend: approval_steg_godkjent / approval_steg_avvist           │
│  - Ved godkjenning: neste nivå varsles                              │
│  - Ved avvisning: pakken returneres til BH                          │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Fullt godkjent                                                     │
│  - Backend: approval_pakke_fullfort event                           │
│  - Responsene sendes som vanlige events:                            │
│    respons_grunnlag, respons_vederlag, respons_frist                │
│  - Catenda synkroniseres                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Brukeropplevelse

1. **Saksbehandler (BH):**
   - Fyller ut responser som vanlig
   - Klikker "Send til godkjenning"
   - Ser status på godkjenningsflyten

2. **Godkjenner (PL/SL/AL/DU/AD):**
   - Får varsel om ventende godkjenning
   - Ser pakkedetaljer (beløp, begrunnelser)
   - Kan godkjenne eller avvise med kommentar

---

## 4. Teknisk design

### 4.1 Event Sourcing (anbefalt)

Godkjenningsflyten implementeres som events i eksisterende Event Sourcing-arkitektur:

```python
# Nye event-typer
class EventType(str, Enum):
    # ... eksisterende ...

    # Godkjenningsflyt
    APPROVAL_PAKKE_OPPRETTET = "approval_pakke_opprettet"
    APPROVAL_STEG_GODKJENT = "approval_steg_godkjent"
    APPROVAL_STEG_AVVIST = "approval_steg_avvist"
    APPROVAL_PAKKE_FULLFORT = "approval_pakke_fullfort"
    APPROVAL_PAKKE_KANSELLERT = "approval_pakke_kansellert"
```

**Fordeler:**
- Konsistent med resten av systemet
- Full audit trail
- Immutable history
- Replay-mulighet

### 4.2 Datamodeller

#### ApprovalPakkeData (event data)

```python
class ApprovalPakkeData(BaseModel):
    """Data for approval_pakke_opprettet event"""
    pakke_id: str
    sak_id: str

    # Innhold (responser som skal godkjennes)
    grunnlag_respons: Optional[GrunnlagResponsData]
    vederlag_respons: Optional[VederlagResponsData]
    frist_respons: Optional[FristResponsData]

    # Beløp
    vederlag_belop: float
    frist_dager: int
    dagmulktsats: float
    frist_belop: float  # frist_dager * dagmulktsats
    samlet_belop: float  # vederlag_belop + frist_belop

    # Godkjenningskjede
    required_approvers: List[ApprovalRole]  # ['PL', 'SL', 'AL']

    # Innsender
    submitted_by: str  # Entra ID user ID
    submitted_by_name: str
    submitted_by_role: ApprovalRole
```

#### ApprovalStegData (event data)

```python
class ApprovalStegData(BaseModel):
    """Data for approval_steg_godkjent/avvist events"""
    pakke_id: str
    steg_rolle: ApprovalRole  # 'PL', 'SL', etc.

    # Godkjenner (fra Entra ID)
    approver_id: str
    approver_name: str
    approver_email: str

    # Beslutning
    kommentar: Optional[str]

    # For avvisning
    avvisning_grunn: Optional[str]
```

### 4.3 State-beregning

```python
class ApprovalPakkeTilstand(BaseModel):
    """Computed state for en godkjenningspakke"""
    pakke_id: str
    sak_id: str
    status: Literal['pending', 'approved', 'rejected', 'cancelled']

    # Fra opprettelse
    samlet_belop: float
    required_approvers: List[ApprovalRole]

    # Gjeldende tilstand
    current_step: int  # 0-indexed
    steps: List[ApprovalStep]

    # Metadata
    submitted_at: datetime
    submitted_by: str
    completed_at: Optional[datetime]
```

### 4.4 API-endepunkter

```yaml
# Nye endepunkter i openapi.yaml

/api/approval-packages:
  post:
    summary: Opprett godkjenningspakke
    operationId: createApprovalPackage
    security: [csrfToken, magicLink]
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ApprovalPakkeData'

/api/approval-packages/{pakke_id}:
  get:
    summary: Hent godkjenningspakke med status
    operationId: getApprovalPackage

/api/approval-packages/{pakke_id}/approve:
  post:
    summary: Godkjenn nåværende steg
    operationId: approveStep
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              kommentar:
                type: string

/api/approval-packages/{pakke_id}/reject:
  post:
    summary: Avvis pakken
    operationId: rejectPackage
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required: [grunn]
            properties:
              grunn:
                type: string

/api/approval-packages/pending:
  get:
    summary: Hent mine ventende godkjenninger
    operationId: getMyPendingApprovals
    description: Basert på innlogget brukers rolle fra Entra ID

/api/me:
  get:
    summary: Hent innlogget bruker
    operationId: getCurrentUser
    description: Returnerer brukerinfo fra Entra ID inkl. rolle og leder

/api/me/manager:
  get:
    summary: Hent brukerens leder
    operationId: getCurrentUserManager
    description: Fra Microsoft Graph API
```

### 4.5 Entra ID-integrasjon

```python
# backend/integrations/entra/client.py

class EntraClient:
    """Microsoft Entra ID / Graph API client"""

    async def get_current_user(self, token: str) -> EntraUser:
        """Hent innlogget bruker fra token"""
        # Dekod JWT, hent brukerinfo fra Graph API
        pass

    async def get_user_manager(self, user_id: str) -> Optional[EntraUser]:
        """Hent brukerens leder via Graph API /me/manager"""
        pass

    async def get_user_role(self, user_id: str) -> ApprovalRole:
        """
        Map Entra ID rolle til ApprovalRole.
        Basert på gruppemedlemskap eller directory extension.
        """
        pass
```

### 4.6 Frontend-endringer

```typescript
// src/api/approval.ts (ny fil)
export async function createApprovalPackage(data: ApprovalPakkeData): Promise<ApprovalPakke>;
export async function getApprovalPackage(pakkeId: string): Promise<ApprovalPakke>;
export async function approveStep(pakkeId: string, kommentar?: string): Promise<void>;
export async function rejectPackage(pakkeId: string, grunn: string): Promise<void>;
export async function getMyPendingApprovals(): Promise<ApprovalPakke[]>;

// src/hooks/useApprovalWorkflow.ts (refaktorert)
export function useApprovalPackage(pakkeId: string) {
  return useQuery({
    queryKey: ['approval', pakkeId],
    queryFn: () => getApprovalPackage(pakkeId),
  });
}

export function useMyPendingApprovals() {
  return useQuery({
    queryKey: ['approval', 'pending'],
    queryFn: getMyPendingApprovals,
  });
}

export function useApproveStep() {
  return useMutation({
    mutationFn: ({ pakkeId, kommentar }) => approveStep(pakkeId, kommentar),
    onSuccess: () => {
      queryClient.invalidateQueries(['approval']);
    },
  });
}
```

---

## 5. Implementasjonsplan

### Fase 1: Backend foundation

| Oppgave | Beskrivelse |
|---------|-------------|
| 1.1 | Definer nye event-typer i `models/events.py` |
| 1.2 | Opprett `models/approval.py` med datamodeller |
| 1.3 | Implementer state-beregning i `models/approval_state.py` |
| 1.4 | Opprett `routes/approval_routes.py` med endepunkter |
| 1.5 | Oppdater `openapi.yaml` med nye schemas |

### Fase 2: Entra ID-integrasjon

| Oppgave | Beskrivelse |
|---------|-------------|
| 2.1 | Opprett `integrations/entra/client.py` |
| 2.2 | Implementer token-validering |
| 2.3 | Implementer Graph API-kall for bruker/leder |
| 2.4 | Map Entra-roller til ApprovalRole |

### Fase 3: Frontend-integrasjon

| Oppgave | Beskrivelse |
|---------|-------------|
| 3.1 | Opprett `src/api/approval.ts` |
| 3.2 | Refaktorer `ApprovalContext` til å bruke API |
| 3.3 | Oppdater `useApprovalWorkflow` hook |
| 3.4 | Fjern localStorage-persistens |
| 3.5 | Fjern mock-organisasjon |

### Fase 4: Testing og dokumentasjon

| Oppgave | Beskrivelse |
|---------|-------------|
| 4.1 | Backend unit tests |
| 4.2 | Frontend component tests |
| 4.3 | E2E test for full flyt |
| 4.4 | Oppdater API-dokumentasjon |

---

## 6. Estimat

### Arbeidsmengde

| Komponent | Nye linjer | Endrede linjer | Tid |
|-----------|------------|----------------|-----|
| Backend events/models | ~250 | - | 0.5 dag |
| Backend routes | ~200 | - | 0.5 dag |
| Backend Entra ID | ~200 | - | 1 dag |
| Frontend API | ~100 | - | 0.5 dag |
| Frontend refaktorering | - | ~300 | 1 dag |
| Testing | ~200 | - | 1 dag |
| **Totalt** | **~950** | **~300** | **~5 dager** |

### Forutsetninger

- Backend Supabase-oppsett eksisterer
- Entra ID tenant er konfigurert
- App registration finnes med Graph API-tilgang

---

## 7. Avhengigheter

### Må være på plass

| Avhengighet | Status | Beskrivelse |
|-------------|--------|-------------|
| Supabase | ✅ Finnes | Database for events |
| Entra ID tenant | ❓ Ukjent | Azure AD for organisasjonen |
| App registration | ❓ Ukjent | For Graph API-tilgang |
| Roller i Entra | ❓ Ukjent | PL/SL/AL/DU/AD må mappes |

### Spørsmål som må avklares

1. **Hvordan mappes roller i Entra ID?**
   - Directory extension attributes?
   - Gruppemedlemskap?
   - Custom claims?

2. **Hva skjer med eksisterende mock-data?**
   - Migrering nødvendig?
   - Feature flag for gradvis utrulling?

3. **Varsling av godkjennere?**
   - E-post?
   - Teams-integrasjon?
   - Kun in-app?

---

## 8. Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Entra ID-oppsett tar tid | Høy | Blokkerer Fase 2 | Start tidlig med IT |
| Rolle-mapping komplisert | Medium | Forsinkelse | Avklar tidlig |
| Ytelse ved mange pakker | Lav | Treg UI | Paginering, caching |
| Brukere uten Entra-konto | Medium | Kan ikke godkjenne | Fallback til mock? |

---

## Vedlegg

### A. Referanser

- `src/context/ApprovalContext.tsx` - Eksisterende frontend-mock
- `src/constants/approvalConfig.ts` - Beløpsgrenser og roller
- `backend/docs/openapi.yaml` - Eksisterende API-spesifikasjon
- `docs/FRONTEND_ARCHITECTURE.md` - Frontend-arkitektur

### B. Relaterte dokumenter

- [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)
- [ARCHITECTURE_AND_DATAMODEL.md](./ARCHITECTURE_AND_DATAMODEL.md)
