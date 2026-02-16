# BIM Object Picker — Design

**Dato:** 2026-02-16
**Status:** Godkjent

## Kontekst

BimCard viser fagkoblinger (ARK, RIB, VVS) til en sak, men mangler mulighet til å velge spesifikke IFC-objekter fra Catenda. Brukeren kan bare legge til fag-nivå-koblinger. For at "Relaterte objekter"-forslag og IFC-egenskaper skal fungere, trenger vi en måte å browse og velge objekter fra Catenda-modellene.

## Mål

Brukeren klikker "Legg til" i BimCard → en modal åpnes der de kan:
1. Filtrere på IFC-type (IfcWall, IfcDoor, etc.) via pills
2. Søke på objektnavn eller GlobalId
3. Velge ett eller flere objekter med avkryssing
4. Bekrefte → nye BIM-koblinger opprettes med fulle objektdetaljer

## Arkitektur

```
BimCard "Legg til" → BimObjectPickerModal (Modal size="lg")
  ├── Header: IFC-type pills (fra get_ifc_type_summary)
  ├── Søkefelt (filtrerer på navn/GlobalId)
  ├── Objekttabell med avkryssing (paginert, 20 per side)
  └── Footer: [Avbryt] [Legg til N valgte]
```

### Dataflyt

```
BimObjectPickerModal
  → useIfcTypeSummary()
    → GET /api/bim/ifc-types
      → catenda_client.get_ifc_type_summary(project_id)
    ← { "IfcWall": 577, "IfcDoor": 234, ... }

  → useIfcProducts(ifcType, search, page)
    → GET /api/bim/ifc-products?ifc_type=IfcWall&search=vegg&page=1&page_size=20
      → catenda_client.list_ifc_products() eller query_ifc_products()
      → match revisionId → cached models → fag
    ← { items: [...], total: 577, page: 1, page_size: 20 }

  → bruker velger objekter → klikker "Legg til"
    → useCreateBimLink(sakId).mutate({...}) for hvert objekt
    → modal lukkes
```

## Backend — Nye endepunkter

### GET /api/bim/ifc-types

Returnerer IFC-type-oppsummering for det aktive prosjektet.

**Respons:**
```json
{
  "types": { "IfcWall": 577, "IfcDoor": 234, "IfcWindow": 156 }
}
```

Bruker `catenda_project_id` fra prosjektets metadata (via `X-Project-ID` header → metadata_repo).

### GET /api/bim/ifc-products

Paginert liste over IFC-produkter med filtrering.

**Query-parametere:**
- `ifc_type` — filtrer på IFC-type (valgfritt)
- `search` — søk i objektnavn (valgfritt)
- `page` — sidenummer (default 1)
- `page_size` — per side (default 20)

**Respons:**
```json
{
  "items": [
    {
      "object_id": 385234324005,
      "global_id": "0iOHjHcXj0ShUoRZVbUrjs",
      "name": "Basic Wall:YV 400:697996",
      "ifc_type": "IfcWall",
      "model_name": "ARK-modell",
      "fag": "ARK"
    }
  ],
  "total": 577,
  "page": 1,
  "page_size": 20
}
```

Backend gjør fag-oppslag ved å matche produktets `revisionId` mot cached models som har `fag`-mapping.

## Frontend — Komponenter

### BimObjectPickerModal

- Props: `open`, `onOpenChange`, `sakId`
- Bruker `Modal` primitiv med `size="lg"`
- State: `selectedType`, `search`, `page`, `selectedIds: Set<number>`

### IfcTypePills

- Følger `PillToggle`-mønster fra CaseListTile
- Viser type + antall: `IfcWall (577)`
- "Alle" som default-valg

### Søkefelt

- MagnifyingGlass-ikon + input, samme mønster som CaseListTile
- Debounced (300ms) for å unngå API-spam

### ObjectTable

- Kolumner: ☐ | Navn | IFC-type | Modell/Fag
- Klikk rad = toggle avkryssing
- Paginering: forrige/neste-knapper + "Side X av Y"

### Footer

- "Avbryt" (sekundær) + "Legg til N valgte" (primær, disabled når N=0)
- Ved bekreftelse: kaller `useCreateBimLink` for hvert valgt objekt

## Fag-tildeling

Auto fra modell: backend matcher produktets `revisionId` mot cached `catenda_model_cache`-tabellen som har `fag`. Fallback: `fag = "Ukjent"` (brukeren kan endre etterpå).

## Filer som endres

| Fil | Endring |
|-----|---------|
| `backend/routes/bim_link_routes.py` | `GET /api/bim/ifc-types` + `GET /api/bim/ifc-products` |
| `src/types/timeline.ts` | `IfcTypeSummary`, `IfcProductItem`, `IfcProductsResponse` |
| `src/api/bim.ts` | `fetchIfcTypes()`, `fetchIfcProducts()` |
| `src/hooks/useBimLinks.ts` | `useIfcTypeSummary()`, `useIfcProducts()` |
| `src/components/bento/BimObjectPickerModal.tsx` | Ny komponent |
| `src/components/bento/BimCard.tsx` | Oppdater "Legg til" til å åpne modal |

## Gjenbruk

- `Modal` primitiv (size="lg")
- `PillToggle`-mønster fra CaseListTile
- `MagnifyingGlassIcon` søke-input fra CaseListTile
- `useCreateBimLink` mutation (allerede utvidet med objekt-felter)
- `@require_magic_link` + `@require_project_access()` dekoratørstack
- `_get_catenda_client()` og `_get_metadata_repo()` DI-hjelpere (allerede i bim_link_routes)
