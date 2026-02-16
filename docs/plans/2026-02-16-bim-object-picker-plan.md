# BIM Object Picker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users browse and select IFC objects from Catenda via a modal, creating BIM-koblinger with full object details.

**Architecture:** Two new backend endpoints proxy Catenda's Model API (IFC type summary + paginated product list with fag lookup). A new modal component in the frontend uses these endpoints with pill-filtering, search, multi-select, and pagination.

**Tech Stack:** Flask endpoints, Catenda Model API, React Query hooks, Radix Dialog (via Modal primitive), Tailwind/Punkt.

**Design:** Se `docs/plans/2026-02-16-bim-object-picker-design.md`

---

## Task 1: Backend — `GET /api/bim/ifc-types` endpoint

**Fil:** `backend/routes/bim_link_routes.py`

Legg til ny route etter `list_bim_models`. Bruk eksisterende `_get_catenda_client()` og `_get_bim_repo()` hjelpere.

```python
@bim_bp.route("/api/bim/ifc-types", methods=["GET"])
@require_magic_link
@require_project_access()
def list_ifc_types():
    """Get IFC type summary (type → count) for the active Catenda project."""
    try:
        prosjekt_id = request.headers.get("X-Project-ID", "oslobygg")
        models = _get_bim_repo().get_cached_models(prosjekt_id)
        if not models:
            return jsonify({"types": {}})

        catenda = _get_catenda_client()
        if not catenda:
            return jsonify({"types": {}})

        # Use first model's catenda_project_id (all models share the same project)
        catenda_project_id = models[0].catenda_project_id
        types = catenda.get_ifc_type_summary(catenda_project_id)
        return jsonify({"types": types})
    except Exception as e:
        logger.error(f"Failed to get IFC types: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500
```

**Verifisering:** `curl http://localhost:8080/api/bim/ifc-types -H "Authorization: Bearer <token>" -H "X-Project-ID: oslobygg"` → `{"types": {"IfcWall": 577, ...}}`

---

## Task 2: Backend — `GET /api/bim/ifc-products` endpoint

**Fil:** `backend/routes/bim_link_routes.py`

Legg til etter `list_ifc_types`. Støtter filtrering på `ifc_type`, søk via `search` (query_ifc_products med attributes.Name-filter), og paginering. Gjør fag-oppslag via cached models.

```python
@bim_bp.route("/api/bim/ifc-products", methods=["GET"])
@require_magic_link
@require_project_access()
def list_ifc_products():
    """List IFC products with filtering, search, and fag lookup."""
    try:
        prosjekt_id = request.headers.get("X-Project-ID", "oslobygg")
        ifc_type = request.args.get("ifc_type")
        search = request.args.get("search", "").strip()
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 20))

        models = _get_bim_repo().get_cached_models(prosjekt_id)
        if not models:
            return jsonify({"items": [], "total": 0, "page": page, "page_size": page_size})

        catenda = _get_catenda_client()
        if not catenda:
            return jsonify({"items": [], "total": 0, "page": page, "page_size": page_size})

        catenda_project_id = models[0].catenda_project_id

        # Build model_id → fag lookup from cached models
        model_fag: dict[str, str] = {}
        for m in models:
            if m.model_id and m.fag:
                model_fag[m.model_id] = m.fag

        if search:
            # Use query API for name search
            query: dict = {}
            if ifc_type:
                query["ifcType"] = {"$ifcType": ifc_type}
            query["attributes.Name"] = {"$regex": search, "$options": "i"}

            products = catenda.query_ifc_products(
                catenda_project_id,
                query=query,
                page=page,
                page_size=page_size,
            )
        else:
            # Simple list with optional type filter
            products = catenda.list_ifc_products(
                catenda_project_id,
                ifc_type=ifc_type,
                page=page,
                page_size=page_size,
            )

        # Map products to response format with fag lookup
        items = []
        for p in products:
            attrs = p.get("attributes", {})
            name_val = attrs.get("Name", "")
            # Name can be string or dict with value
            if isinstance(name_val, dict):
                name_val = name_val.get("value", "")
            global_id_val = attrs.get("GlobalId", "")
            if isinstance(global_id_val, dict):
                global_id_val = global_id_val.get("value", "")

            # Fag lookup: revisionId → find matching model
            fag = None
            model_name = None
            revision_id = p.get("revisionId")
            if revision_id:
                for m in models:
                    # Models may match via model_id; try matching name heuristic
                    if m.fag:
                        fag = fag or m.fag
                        model_name = model_name or m.model_name

            items.append({
                "object_id": p.get("objectId"),
                "global_id": str(global_id_val),
                "name": str(name_val) if name_val else None,
                "ifc_type": p.get("ifcType"),
                "model_name": model_name,
                "fag": fag,
            })

        # Total count: use type summary for accurate count when filtering by type
        total = len(products)
        if ifc_type and not search:
            types = catenda.get_ifc_type_summary(catenda_project_id)
            total = int(types.get(ifc_type, total))

        return jsonify({
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        })
    except Exception as e:
        logger.error(f"Failed to list IFC products: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500
```

**Verifisering:** `curl "http://localhost:8080/api/bim/ifc-products?ifc_type=IfcWall&page=1&page_size=5" -H "Authorization: Bearer <token>" -H "X-Project-ID: oslobygg"` → JSON med items-array.

---

## Task 3: Frontend — Typer, API-funksjoner og hooks

**Fil `src/types/timeline.ts`** — legg til etter `RelatedBimGroup`:

```typescript
/** IFC type summary: type name → count */
export type IfcTypeSummary = Record<string, number>;

/** A single IFC product item from the object picker API */
export interface IfcProductItem {
  object_id: number;
  global_id: string;
  name: string | null;
  ifc_type: string | null;
  model_name: string | null;
  fag: string | null;
}

/** Paginated response from GET /api/bim/ifc-products */
export interface IfcProductsResponse {
  items: IfcProductItem[];
  total: number;
  page: number;
  page_size: number;
}
```

**Fil `src/api/bim.ts`** — legg til:

```typescript
export async function fetchIfcTypes(): Promise<{ types: IfcTypeSummary }> {
  return apiFetch<{ types: IfcTypeSummary }>('/api/bim/ifc-types');
}

export async function fetchIfcProducts(params: {
  ifc_type?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<IfcProductsResponse> {
  const searchParams = new URLSearchParams();
  if (params.ifc_type) searchParams.set('ifc_type', params.ifc_type);
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  const qs = searchParams.toString();
  return apiFetch<IfcProductsResponse>(`/api/bim/ifc-products${qs ? `?${qs}` : ''}`);
}
```

Husk å importere `IfcTypeSummary` og `IfcProductsResponse` fra types.

**Fil `src/hooks/useBimLinks.ts`** — legg til:

```typescript
export function useIfcTypeSummary() {
  return useQuery({
    queryKey: ['ifc-types', getActiveProjectId()] as const,
    queryFn: fetchIfcTypes,
    staleTime: 5 * STALE_TIME.EXTENDED,
  });
}

export function useIfcProducts(params: {
  ifcType?: string;
  search?: string;
  page: number;
}) {
  return useQuery({
    queryKey: ['ifc-products', getActiveProjectId(), params.ifcType, params.search, params.page] as const,
    queryFn: () =>
      fetchIfcProducts({
        ifc_type: params.ifcType,
        search: params.search || undefined,
        page: params.page,
        page_size: 20,
      }),
    staleTime: STALE_TIME.EXTENDED,
  });
}
```

Husk å importere `fetchIfcTypes` og `fetchIfcProducts` fra api/bim.

**Verifisering:** `npx tsc --noEmit` — ingen nye feil.

---

## Task 4: Frontend — `BimObjectPickerModal` komponent

**Ny fil:** `src/components/bento/BimObjectPickerModal.tsx`

Komplett komponent med:
- IFC-type pills øverst (fra `useIfcTypeSummary`)
- Søkefelt med debounce (300ms)
- Objekttabell med avkryssing og paginering
- Footer med "Avbryt" og "Legg til N valgte"
- Kaller `useCreateBimLink` for hvert valgt objekt ved bekreftelse

```typescript
import { useState, useMemo, useCallback } from 'react';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import { Modal } from '../primitives/Modal';
import { useIfcTypeSummary, useIfcProducts, useCreateBimLink } from '../../hooks/useBimLinks';
import type { IfcProductItem } from '../../types/timeline';

interface BimObjectPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
}

const PAGE_SIZE = 20;

export function BimObjectPickerModal({ open, onOpenChange, sakId }: BimObjectPickerModalProps) {
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Map<number, IfcProductItem>>(new Map());

  const { data: typesData } = useIfcTypeSummary();
  const { data: productsData, isLoading } = useIfcProducts({
    ifcType: selectedType,
    search: debouncedSearch,
    page,
  });

  const createLink = useCreateBimLink(sakId);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  // Sort types by count descending
  const sortedTypes = useMemo(() => {
    if (!typesData?.types) return [];
    return Object.entries(typesData.types)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15); // Top 15 types
  }, [typesData]);

  const totalPages = productsData ? Math.ceil(productsData.total / PAGE_SIZE) : 0;

  const toggleSelect = (item: IfcProductItem) => {
    setSelectedIds((prev) => {
      const next = new Map(prev);
      if (next.has(item.object_id)) {
        next.delete(item.object_id);
      } else {
        next.set(item.object_id, item);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    for (const item of selectedIds.values()) {
      createLink.mutate({
        fag: item.fag || 'Ukjent',
        object_id: item.object_id,
        object_global_id: item.global_id,
        object_name: item.name ?? undefined,
        object_ifc_type: item.ifc_type ?? undefined,
      });
    }
    setSelectedIds(new Map());
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Velg BIM-objekt" size="lg">
      <div className="space-y-3">
        {/* IFC type pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => { setSelectedType(undefined); setPage(1); }}
            className={clsx(
              'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
              !selectedType
                ? 'bg-pkt-brand-dark-blue-1000 text-white border-transparent'
                : 'text-pkt-text-body-subtle border-pkt-border-default hover:bg-pkt-bg-subtle',
            )}
          >
            Alle
          </button>
          {sortedTypes.map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => { setSelectedType(type); setPage(1); }}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                selectedType === type
                  ? 'bg-pkt-brand-dark-blue-1000 text-white border-transparent'
                  : 'text-pkt-text-body-subtle border-pkt-border-default hover:bg-pkt-bg-subtle',
              )}
            >
              {type.replace('Ifc', '')} <span className="opacity-60 tabular-nums">{count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pkt-text-body-subtle pointer-events-none" />
          <input
            type="text"
            placeholder="Sok pa navn eller GlobalId..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-pkt-bg-subtle border border-transparent focus:border-pkt-border-default focus:outline-none"
          />
        </div>

        {/* Object table */}
        <div className="min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="h-5 w-5 border-2 border-pkt-text-body-subtle/30 border-t-pkt-text-body-subtle rounded-full animate-spin" />
            </div>
          ) : productsData?.items.length === 0 ? (
            <p className="text-xs text-pkt-text-body-subtle italic text-center py-12">
              Ingen objekter funnet
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-pkt-text-body-subtle border-b border-pkt-border-default">
                  <th className="pb-1.5 w-8"></th>
                  <th className="pb-1.5">Navn</th>
                  <th className="pb-1.5">Type</th>
                  <th className="pb-1.5">Fag</th>
                </tr>
              </thead>
              <tbody>
                {productsData?.items.map((item) => (
                  <tr
                    key={item.object_id}
                    onClick={() => toggleSelect(item)}
                    className={clsx(
                      'border-b border-pkt-border-subtle cursor-pointer transition-colors',
                      selectedIds.has(item.object_id)
                        ? 'bg-pkt-brand-dark-blue-1000/5'
                        : 'hover:bg-pkt-bg-subtle',
                    )}
                  >
                    <td className="py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.object_id)}
                        onChange={() => toggleSelect(item)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-1.5 text-pkt-text-body-default">
                      {item.name || <span className="opacity-50">Uten navn</span>}
                    </td>
                    <td className="py-1.5 text-pkt-text-body-subtle">
                      {item.ifc_type?.replace('Ifc', '')}
                    </td>
                    <td className="py-1.5 text-pkt-text-body-subtle">
                      {item.fag || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-pkt-text-body-subtle">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-2 py-1 rounded hover:bg-pkt-bg-subtle disabled:opacity-30"
            >
              Forrige
            </button>
            <span className="tabular-nums">Side {page} av {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-2 py-1 rounded hover:bg-pkt-bg-subtle disabled:opacity-30"
            >
              Neste
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-pkt-border-default">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-pkt-text-body-subtle hover:bg-pkt-bg-subtle"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || createLink.isPending}
            onClick={handleConfirm}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-pkt-brand-dark-blue-1000 text-white disabled:opacity-40"
          >
            Legg til {selectedIds.size > 0 ? `${selectedIds.size} valgte` : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

**NB:** Husk å legge til `useRef` i React-importen.

**Verifisering:** `npx tsc --noEmit` — ingen nye feil.

---

## Task 5: Frontend — Koble modal til BimCard

**Fil:** `src/components/bento/BimCard.tsx`

**Steg 1:** Importer modalen:
```typescript
import { BimObjectPickerModal } from './BimObjectPickerModal';
```

**Steg 2:** Legg til state i `BimCard`:
```typescript
const [pickerOpen, setPickerOpen] = useState(false);
```

**Steg 3:** Endre "Legg til"-knappen til å åpne modalen i stedet for `showAdd`:
```typescript
<button
  onClick={() => setPickerOpen(true)}
  className="flex items-center gap-0.5 text-[10px] font-medium text-pkt-text-body-subtle hover:text-pkt-text-body-default transition-colors"
>
  <PlusIcon className="w-3 h-3" />
  Legg til
</button>
```

Fjern `showAdd`-state og den gamle fag-dropdown-seksjonen (den erstattes av modalen).

**Steg 4:** Render modalen i BimCard:
```typescript
<BimObjectPickerModal
  open={pickerOpen}
  onOpenChange={setPickerOpen}
  sakId={sakId}
/>
```

Fjern også `availableFag`, `handleAddFag`, `getAvailableFag`-funksjonen, og `useBimModels()`-hooken — disse er ikke lenger nødvendige.

**Verifisering:** Frontend kompilerer og modalen åpnes ved klikk på "Legg til".

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `backend/routes/bim_link_routes.py` | `GET /api/bim/ifc-types` + `GET /api/bim/ifc-products` |
| `src/types/timeline.ts` | `IfcTypeSummary`, `IfcProductItem`, `IfcProductsResponse` |
| `src/api/bim.ts` | `fetchIfcTypes()`, `fetchIfcProducts()` |
| `src/hooks/useBimLinks.ts` | `useIfcTypeSummary()`, `useIfcProducts()` |
| `src/components/bento/BimObjectPickerModal.tsx` | Ny komponent |
| `src/components/bento/BimCard.tsx` | Erstatt fag-dropdown med modal |
