# BIM-kobling: Knytt IFC-objekter til KOE-saker

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** La brukere knytte BIM-modeller (fag/modell/objekt) til KOE-saker for sporbarhet mellom kontrakt og bygningsmodell.

**Architecture:** Ikke-event-sourcet metadata (som `sak_metadata`). BIM-koblinger lagres i en egen Supabase-tabell `sak_bim_links` med fremmednøkkel til `sak_id`. Frontend viser et eget BentoCard med trestruktur: Fag → Modell → Objekter. Dataen hentes fra Catenda Model API og caches lokalt.

**Tech Stack:** Supabase (PostgreSQL), Flask API, React + React Query, Catenda Model API v2

**Viktige designvalg:**
- BIM-kobling er **ikke** event-sourcet — det er metadata om saken, ikke en kontraktshendelse
- Feltet er **valgfritt** — ingen validering krever BIM-kobling
- Trestrukturen er Fag → Modell → Objekt, der brukeren velger Fag først
- Catenda-modeller caches i en egen tabell for å unngå API-kall ved visning

---

## Oversikt

| Task | Beskrivelse | Lag |
|------|------------|-----|
| 1 | Supabase-tabeller (`sak_bim_links`, `catenda_models_cache`) | DB |
| 2 | Backend Pydantic-modeller | Backend |
| 3 | Backend repository for BIM-koblinger | Backend |
| 4 | Backend API-endepunkter (CRUD) | Backend |
| 5 | Seed testdata direkte i Supabase | DB |
| 6 | Frontend TypeScript-typer | Frontend |
| 7 | Frontend API-klient og React Query hooks | Frontend |
| 8 | BimCard bento-komponent (visning) | Frontend |
| 9 | Integrer BimCard i CasePageBento | Frontend |

---

### Task 1: Supabase-tabeller

**Files:**
- Create: `backend/migrations/003_sak_bim_links.sql`

**Step 1: Skriv migrasjons-SQL**

```sql
-- ============================================================
-- BIM Link Tables
-- Links KOE cases to Catenda BIM models and objects
-- ============================================================

-- Cache of Catenda models per project (refreshed periodically)
CREATE TABLE IF NOT EXISTS catenda_models_cache (
    id SERIAL PRIMARY KEY,
    prosjekt_id TEXT NOT NULL,
    catenda_project_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    fag TEXT,  -- ARK, RIB, VVS_RIE, VVS_RIR, VVS_RIV, LARK, etc.
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(catenda_project_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_catenda_models_prosjekt ON catenda_models_cache(prosjekt_id);

-- BIM links: many-to-many between sak and Catenda models/objects
CREATE TABLE IF NOT EXISTS sak_bim_links (
    id SERIAL PRIMARY KEY,
    sak_id TEXT NOT NULL REFERENCES sak_metadata(sak_id) ON DELETE CASCADE,

    -- What is linked (hierarchical: fag required, model optional, object optional)
    fag TEXT NOT NULL,           -- ARK, RIB, VVS, LARK, etc.
    model_id TEXT,               -- Catenda model ID (null = whole discipline)
    model_name TEXT,             -- Cached name for display
    object_id BIGINT,            -- Catenda objectId (null = whole model)
    object_global_id TEXT,       -- IFC GlobalId for cross-system reference
    object_name TEXT,            -- Cached object name for display
    object_ifc_type TEXT,        -- e.g. IfcWall, IfcDoor

    -- Metadata
    linked_by TEXT NOT NULL,     -- Who created the link
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kommentar TEXT,              -- Optional context

    -- Prevent duplicate links
    UNIQUE(sak_id, fag, COALESCE(model_id, ''), COALESCE(object_global_id, ''))
);

CREATE INDEX IF NOT EXISTS idx_sak_bim_links_sak ON sak_bim_links(sak_id);
CREATE INDEX IF NOT EXISTS idx_sak_bim_links_fag ON sak_bim_links(fag);
CREATE INDEX IF NOT EXISTS idx_sak_bim_links_model ON sak_bim_links(model_id);

-- RLS
ALTER TABLE sak_bim_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE catenda_models_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sak_bim_links"
ON sak_bim_links FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read sak_bim_links"
ON sak_bim_links FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access on catenda_models_cache"
ON catenda_models_cache FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read catenda_models_cache"
ON catenda_models_cache FOR SELECT
USING (auth.role() = 'authenticated');
```

**Step 2: Kjør migrasjonen i Supabase**

Kjør SQL-en via Supabase SQL Editor eller MCP-verktøy.

**Step 3: Commit**

```bash
git add backend/migrations/003_sak_bim_links.sql
git commit -m "feat: add sak_bim_links and catenda_models_cache tables"
```

---

### Task 2: Backend Pydantic-modeller

**Files:**
- Create: `backend/models/bim_link.py`

**Step 1: Skriv modellene**

```python
"""
BIM Link models — Pydantic v2 models for BIM-to-case linking.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class BimLink(BaseModel):
    """A link between a KOE case and a BIM model/object."""

    id: int | None = None
    sak_id: str
    fag: str  # ARK, RIB, VVS, LARK, etc.
    model_id: str | None = None
    model_name: str | None = None
    object_id: int | None = None
    object_global_id: str | None = None
    object_name: str | None = None
    object_ifc_type: str | None = None
    linked_by: str
    linked_at: datetime = Field(default_factory=datetime.utcnow)
    kommentar: str | None = None


class BimLinkCreate(BaseModel):
    """Request body for creating a BIM link."""

    fag: str = Field(..., min_length=1, description="Discipline: ARK, RIB, VVS, etc.")
    model_id: str | None = None
    model_name: str | None = None
    object_id: int | None = None
    object_global_id: str | None = None
    object_name: str | None = None
    object_ifc_type: str | None = None
    kommentar: str | None = None


class CatendaModelCache(BaseModel):
    """Cached Catenda model info."""

    id: int | None = None
    prosjekt_id: str
    catenda_project_id: str
    model_id: str
    model_name: str
    fag: str | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

**Step 2: Commit**

```bash
git add backend/models/bim_link.py
git commit -m "feat: add BimLink and CatendaModelCache Pydantic models"
```

---

### Task 3: Backend repository

**Files:**
- Create: `backend/repositories/bim_link_repository.py`

**Step 1: Skriv repository**

```python
"""
Repository for BIM link CRUD operations in Supabase.
"""

import os
from datetime import datetime

from utils.logger import get_logger

try:
    from supabase import Client, create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from lib.supabase import with_retry
from models.bim_link import BimLink, BimLinkCreate, CatendaModelCache

logger = get_logger(__name__)


class BimLinkRepository:
    """CRUD for sak_bim_links table."""

    TABLE_NAME = "sak_bim_links"
    MODELS_CACHE_TABLE = "catenda_models_cache"

    def __init__(self, url: str | None = None, key: str | None = None):
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase client not installed")
        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = (
            key
            or os.environ.get("SUPABASE_SECRET_KEY")
            or os.environ.get("SUPABASE_KEY")
        )
        if not self.url or not self.key:
            raise ValueError("Supabase credentials required")
        self.client: Client = create_client(self.url, self.key)

    @with_retry()
    def get_links_for_sak(self, sak_id: str) -> list[BimLink]:
        """Get all BIM links for a case."""
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("sak_id", sak_id)
            .order("fag")
            .order("model_name")
            .execute()
        )
        return [BimLink(**row) for row in (result.data or [])]

    @with_retry()
    def create_link(self, sak_id: str, link: BimLinkCreate, linked_by: str) -> BimLink:
        """Create a new BIM link."""
        row = {
            "sak_id": sak_id,
            "linked_by": linked_by,
            **link.model_dump(exclude_none=True),
        }
        result = self.client.table(self.TABLE_NAME).insert(row).execute()
        return BimLink(**(result.data[0]))

    @with_retry()
    def delete_link(self, link_id: int) -> bool:
        """Delete a BIM link by ID."""
        result = (
            self.client.table(self.TABLE_NAME)
            .delete()
            .eq("id", link_id)
            .execute()
        )
        return len(result.data or []) > 0

    @with_retry()
    def get_cached_models(self, prosjekt_id: str) -> list[CatendaModelCache]:
        """Get cached Catenda models for a project."""
        result = (
            self.client.table(self.MODELS_CACHE_TABLE)
            .select("*")
            .eq("prosjekt_id", prosjekt_id)
            .order("fag")
            .order("model_name")
            .execute()
        )
        return [CatendaModelCache(**row) for row in (result.data or [])]

    @with_retry()
    def upsert_cached_models(self, models: list[CatendaModelCache]) -> int:
        """Upsert model cache entries. Returns count of upserted rows."""
        if not models:
            return 0
        rows = [m.model_dump(exclude={"id"}) for m in models]
        for row in rows:
            row["updated_at"] = datetime.utcnow().isoformat()
        result = (
            self.client.table(self.MODELS_CACHE_TABLE)
            .upsert(rows, on_conflict="catenda_project_id,model_id")
            .execute()
        )
        return len(result.data or [])
```

**Step 2: Registrer i DI-container**

Modify: `backend/core/container.py` — legg til `bim_link_repository` som lazy property, etter mønsteret for andre repositories.

**Step 3: Commit**

```bash
git add backend/repositories/bim_link_repository.py backend/core/container.py
git commit -m "feat: add BimLinkRepository with CRUD operations"
```

---

### Task 4: Backend API-endepunkter

**Files:**
- Create: `backend/routes/bim_link_routes.py`
- Modify: `backend/routes/__init__.py` (registrer blueprint)

**Step 1: Skriv routes**

```python
"""
BIM Link API routes.

GET    /api/saker/<sak_id>/bim-links      — List links for a case
POST   /api/saker/<sak_id>/bim-links      — Create a new link
DELETE /api/saker/<sak_id>/bim-links/<id>  — Remove a link
GET    /api/bim/models                     — List cached models for active project
"""

from flask import Blueprint, jsonify, request

from core.container import container
from lib.auth.magic_link import require_magic_link
from lib.auth.project_access import require_project_access
from models.bim_link import BimLinkCreate

bim_bp = Blueprint("bim", __name__)


@bim_bp.route("/api/saker/<sak_id>/bim-links", methods=["GET"])
@require_magic_link
@require_project_access(min_role="viewer")
def list_bim_links(sak_id: str):
    """List all BIM links for a case."""
    repo = container.bim_link_repository
    links = repo.get_links_for_sak(sak_id)
    return jsonify([link.model_dump(mode="json") for link in links])


@bim_bp.route("/api/saker/<sak_id>/bim-links", methods=["POST"])
@require_magic_link
@require_project_access(min_role="member")
def create_bim_link(sak_id: str):
    """Create a new BIM link."""
    data = request.get_json()
    link_data = BimLinkCreate.model_validate(data)

    user_email = request.magic_link_data.get("email", "unknown")
    repo = container.bim_link_repository
    created = repo.create_link(sak_id, link_data, linked_by=user_email)

    return jsonify(created.model_dump(mode="json")), 201


@bim_bp.route("/api/saker/<sak_id>/bim-links/<int:link_id>", methods=["DELETE"])
@require_magic_link
@require_project_access(min_role="member")
def delete_bim_link(sak_id: str, link_id: int):
    """Delete a BIM link."""
    repo = container.bim_link_repository
    deleted = repo.delete_link(link_id)
    if not deleted:
        return jsonify({"error": "Link not found"}), 404
    return "", 204


@bim_bp.route("/api/bim/models", methods=["GET"])
@require_magic_link
@require_project_access(min_role="viewer")
def list_bim_models():
    """List cached Catenda models for the active project."""
    prosjekt_id = request.headers.get("X-Project-ID", "oslobygg")
    repo = container.bim_link_repository
    models = repo.get_cached_models(prosjekt_id)
    return jsonify([m.model_dump(mode="json") for m in models])
```

**Step 2: Registrer blueprint i `routes/__init__.py`**

Legg til `from routes.bim_link_routes import bim_bp` og `app.register_blueprint(bim_bp)` etter mønsteret for andre blueprints.

**Step 3: Commit**

```bash
git add backend/routes/bim_link_routes.py backend/routes/__init__.py
git commit -m "feat: add BIM link API endpoints (CRUD + model list)"
```

---

### Task 5: Seed testdata i Supabase

**Files:** Ingen filer — kjøres som SQL direkte.

**Step 1: Seed modell-cache**

Bruk Supabase MCP `execute_sql` eller SQL Editor:

```sql
-- Seed catenda_models_cache med modellene fra Lambertseter-prosjektet
INSERT INTO catenda_models_cache (prosjekt_id, catenda_project_id, model_id, model_name, fag)
VALUES
    ('oslobygg', '5c3a6c4036e04b5a806998d02a98b040', 'dcfffc62809f4d9481022da93844249e', '0111_ARK', 'ARK'),
    ('oslobygg', '5c3a6c4036e04b5a806998d02a98b040', 'a47fa618e0134ad09744e507afd9e70d', '0131_LARK', 'LARK'),
    ('oslobygg', '5c3a6c4036e04b5a806998d02a98b040', '076b266e361640cfa5fab7f904075744', '0121_RIB', 'RIB'),
    ('oslobygg', '5c3a6c4036e04b5a806998d02a98b040', '0256ce23f0ff45a380b28508e4fab4e3', '0141_VVS_RIE', 'VVS'),
    ('oslobygg', '5c3a6c4036e04b5a806998d02a98b040', 'e8c3c92485ba47159f017be580c9babf', '0142_VVS_RIR', 'VVS'),
    ('oslobygg', '5c3a6c4036e04b5a806998d02a98b040', '5c2077c10a874a9e8514de5889368d2d', '0143_VVS_RIV', 'VVS')
ON CONFLICT (catenda_project_id, model_id) DO UPDATE SET
    model_name = EXCLUDED.model_name,
    fag = EXCLUDED.fag,
    updated_at = NOW();
```

**Step 2: Seed BIM-koblinger på noen eksisterende saker**

```sql
-- Finn aktive saker
SELECT sak_id, cached_title FROM sak_metadata
WHERE cached_status NOT IN ('LUKKET', 'LUKKET_TRUKKET')
ORDER BY last_event_at DESC LIMIT 5;

-- Legg til BIM-koblinger (erstatt sak_id med faktiske verdier)
INSERT INTO sak_bim_links (sak_id, fag, model_id, model_name, linked_by)
VALUES
    ('<sak_id_1>', 'ARK', 'dcfffc62809f4d9481022da93844249e', '0111_ARK', 'seed@test.no'),
    ('<sak_id_1>', 'RIB', '076b266e361640cfa5fab7f904075744', '0121_RIB', 'seed@test.no'),
    ('<sak_id_2>', 'VVS', NULL, NULL, 'seed@test.no');
```

**Step 3: Verifiser**

```sql
SELECT s.sak_id, s.cached_title, b.fag, b.model_name
FROM sak_bim_links b
JOIN sak_metadata s ON s.sak_id = b.sak_id
ORDER BY s.sak_id, b.fag;
```

---

### Task 6: Frontend TypeScript-typer

**Files:**
- Modify: `src/types/timeline.ts` (legg til BIM-typer)

**Step 1: Legg til typer**

Legg til nederst i filen, før eventuell `export`:

```typescript
// ============================================================
// BIM Link Types
// ============================================================

/** Discipline codes matching Catenda model naming convention */
export type BimFag = 'ARK' | 'RIB' | 'VVS' | 'LARK' | string;

/** A link between a case and a BIM model/object */
export interface BimLink {
  id: number;
  sak_id: string;
  fag: BimFag;
  model_id?: string;
  model_name?: string;
  object_id?: number;
  object_global_id?: string;
  object_name?: string;
  object_ifc_type?: string;
  linked_by: string;
  linked_at: string;
  kommentar?: string;
}

/** Cached Catenda model for the active project */
export interface CatendaModel {
  id: number;
  prosjekt_id: string;
  catenda_project_id: string;
  model_id: string;
  model_name: string;
  fag?: string;
  updated_at: string;
}
```

**Step 2: Commit**

```bash
git add src/types/timeline.ts
git commit -m "feat: add BimLink and CatendaModel TypeScript types"
```

---

### Task 7: Frontend API-klient og hooks

**Files:**
- Create: `src/api/bim.ts`
- Create: `src/hooks/useBimLinks.ts`

**Step 1: API-klient**

```typescript
// src/api/bim.ts
import { apiFetch } from './client';
import type { BimLink, CatendaModel } from '../types/timeline';

export async function fetchBimLinks(sakId: string): Promise<BimLink[]> {
  return apiFetch<BimLink[]>(`/api/saker/${sakId}/bim-links`);
}

export async function createBimLink(
  sakId: string,
  data: { fag: string; model_id?: string; model_name?: string; kommentar?: string }
): Promise<BimLink> {
  return apiFetch<BimLink>(`/api/saker/${sakId}/bim-links`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteBimLink(sakId: string, linkId: number): Promise<void> {
  await apiFetch(`/api/saker/${sakId}/bim-links/${linkId}`, { method: 'DELETE' });
}

export async function fetchBimModels(): Promise<CatendaModel[]> {
  return apiFetch<CatendaModel[]>('/api/bim/models');
}
```

**Step 2: React Query hooks**

```typescript
// src/hooks/useBimLinks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBimLinks, createBimLink, deleteBimLink, fetchBimModels } from '../api/bim';
import { getActiveProjectId } from '../api/client';

const bimKeys = {
  links: (sakId: string) => ['bim-links', getActiveProjectId(), sakId] as const,
  models: () => ['bim-models', getActiveProjectId()] as const,
};

export function useBimLinks(sakId: string) {
  return useQuery({
    queryKey: bimKeys.links(sakId),
    queryFn: () => fetchBimLinks(sakId),
    staleTime: 60_000,
  });
}

export function useBimModels() {
  return useQuery({
    queryKey: bimKeys.models(),
    queryFn: fetchBimModels,
    staleTime: 5 * 60_000, // models change rarely
  });
}

export function useCreateBimLink(sakId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { fag: string; model_id?: string; model_name?: string }) =>
      createBimLink(sakId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bimKeys.links(sakId) });
    },
  });
}

export function useDeleteBimLink(sakId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: number) => deleteBimLink(sakId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bimKeys.links(sakId) });
    },
  });
}
```

**Step 3: Commit**

```bash
git add src/api/bim.ts src/hooks/useBimLinks.ts
git commit -m "feat: add BIM link API client and React Query hooks"
```

---

### Task 8: BimCard bento-komponent

**Files:**
- Create: `src/components/bento/BimCard.tsx`

**Step 1: Skriv komponenten**

Vis BIM-koblinger gruppert per fag, med mulighet for å legge til nye.

Referansefiler for stil:
- `src/components/dashboard/BentoCard.tsx:21-42` — wrapper
- `src/components/bento/CaseMasterCard.tsx:105-135` — header-mønster
- `src/components/primitives/Badge.tsx` — badge-varianter

Strukturforslag:

```
┌──────────────────────────────────────┐
│ BIM-KOBLING                  + Legg  │
│                                til   │
│ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │ ARK  │ │ RIB  │ │ VVS  │         │
│ │      │ │      │ │      │         │
│ │0111  │ │0121  │ │(fag) │         │
│ └──────┘ └──────┘ └──────┘         │
│                                      │
│ Ingen objekter koblet ennå           │
└──────────────────────────────────────┘
```

Nøkkel-CSS-klasser (bruk eksisterende designsystem):
- Container: `bg-pkt-bg-card rounded-lg p-4 border border-pkt-border-subtle`
- Header: `text-[10px] font-semibold uppercase tracking-wide text-pkt-text-body-subtle`
- Fag-chips: `px-2 py-1 text-xs font-medium rounded-full` med fargekoding per fag
- Legg til-knapp: `text-xs text-pkt-text-action-active hover:underline`
- Tom tilstand: `text-xs text-pkt-text-body-muted italic`

Fag-farger (forslag):
- ARK: `bg-pkt-brand-dark-blue-100 text-pkt-brand-dark-blue-1000`
- RIB: `bg-pkt-brand-dark-green-100 text-pkt-brand-dark-green-1000`
- VVS: `bg-pkt-brand-warm-blue-100 text-pkt-brand-warm-blue-1000`
- LARK: `bg-pkt-brand-yellow-100 text-pkt-brand-yellow-1000`

Komponent-props:

```typescript
interface BimCardProps {
  sakId: string;
  userRole: 'TE' | 'BH';
  className?: string;
}
```

Legg til-flyten:
1. Klikk "+ Legg til" → vis dropdown med tilgjengelige fag (fra `useBimModels()`, gruppert)
2. Velg fag → oppretter link med `useCreateBimLink()`
3. Valgfritt: ekspander fag for å velge spesifikk modell (trinn 2)

Slett-flyt:
- Hover på fag-chip → vis ×-knapp
- Klikk × → `useDeleteBimLink()`

**Step 2: Commit**

```bash
git add src/components/bento/BimCard.tsx
git commit -m "feat: add BimCard bento component with fag chips"
```

---

### Task 9: Integrer i CasePageBento

**Files:**
- Modify: `src/pages/CasePageBento.tsx`

**Step 1: Importer og plasser BimCard**

Legg til BimCard i bento-gridet. Plasseringsforslag: under CaseMasterCard i venstre kolonne, eller som eget full-width kort under claim-radene.

Anbefalt plassering — under Master Card (begge tracks synlige):

```tsx
{/* LEFT COLUMN */}
<div className={expandedTrack ? 'col-span-12' : 'col-span-12 md:col-span-6'}>
  <CaseMasterCard ... />
  {!expandedTrack && (
    <div className="mt-2 sm:mt-4">
      <BimCard sakId={sakId} userRole={userRole} />
    </div>
  )}
</div>
```

**Step 2: Verifiser visuelt**

Sjekk:
- [ ] BimCard vises under CaseMasterCard
- [ ] Seeded data viser fag-chips (ARK, RIB, etc.)
- [ ] Tom tilstand viser "Ingen modeller koblet"
- [ ] Legg til-flyt fungerer
- [ ] Slett fungerer
- [ ] Responsivt (col-12 på mobil)

**Step 3: Commit**

```bash
git add src/pages/CasePageBento.tsx
git commit -m "feat: integrate BimCard in CasePageBento grid"
```

---

## Fremtidige utvidelser (ikke i scope nå)

- **Automatisk sync fra Catenda viewpoints** — bruk `get_bim_objects_for_topic()` for å auto-populere
- **Objekt-nivå drill-down** — la bruker velge spesifikke objekter innenfor en modell
- **Fag-chips i saksoversikten** — vis `ARK RIB` inline i CaseListTile
- **Analyse-dashboard** — "Hvilke fagmodeller har flest tvister?"
- **3D-viewer-link** — deep-link til Catenda viewer med objekt markert
