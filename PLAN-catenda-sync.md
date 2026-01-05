# Plan: Catenda-synkronisering for alle endepunkter

## Bakgrunn

### Nåværende tilstand
- `POST /api/events` synkroniserer til Catenda (PDF + kommentar + status) ✅
- `POST /api/forsering/.../bh-respons` lagrer kun i Supabase ❌
- `POST /api/forsering/.../stopp` lagrer kun i Supabase ❌
- `POST /api/forsering/.../kostnader` lagrer kun i Supabase ❌
- Endringsordre-endepunkter opererer på Catenda-relasjoner, men logger ikke events

### Forutsetninger for Catenda-synkronisering
1. Catenda OAuth er autentisert (token gyldig)
2. Saken har `catenda_topic_id` (BFC topic GUID) lagret i metadata

### Problem: Manglende tilbakemelding
Backend returnerer `pdf_uploaded: true/false`, men:
- Frontend viser **ikke** varsel om at data kun er lagret i Supabase
- Bruker vet ikke om Catenda-synkronisering feilet eller ble hoppet over

---

## Del 1: Refaktorere Catenda-posting til gjenbrukbar funksjon

### Oppgave 1.1: Flytt `_post_to_catenda` til egen modul

**Fil:** `backend/services/catenda_sync_service.py`

```python
class CatendaSyncService:
    """Håndterer synkronisering av events til Catenda BFC."""

    def sync_event_to_catenda(
        self,
        sak_id: str,
        state: SakState,
        event: BaseEvent,
        topic_id: str,
        old_status: Optional[str] = None,
        pdf_base64: Optional[str] = None,
        pdf_filename: Optional[str] = None
    ) -> CatendaSyncResult:
        """
        Synkroniserer et event til Catenda.

        Returns:
            CatendaSyncResult med:
            - success: bool
            - comment_posted: bool
            - pdf_uploaded: bool
            - status_updated: bool
            - error: Optional[str]
        """
```

### Oppgave 1.2: Oppdater `event_routes.py`
- Importer og bruk `CatendaSyncService` istedenfor inline `_post_to_catenda`

---

## Del 2: Catenda-synkronisering for forsering-endepunkter

### Oppgave 2.1: Oppdater `forsering_routes.py`

For hvert endepunkt (bh-respons, stopp, kostnader):

```python
@forsering_bp.route('/api/forsering/<sak_id>/bh-respons', methods=['POST'])
def registrer_bh_respons(sak_id: str):
    # ... eksisterende logikk ...

    # Ny: Catenda-synkronisering
    catenda_result = None
    metadata = metadata_repo.get_by_sak_id(sak_id)
    if metadata and metadata.catenda_topic_id:
        sync_service = CatendaSyncService(...)
        catenda_result = sync_service.sync_event_to_catenda(
            sak_id=sak_id,
            state=new_state,
            event=event,  # Må returneres fra service
            topic_id=metadata.catenda_topic_id
        )

    return jsonify({
        "success": True,
        "catenda_synced": catenda_result.success if catenda_result else False,
        "catenda_comment_posted": catenda_result.comment_posted if catenda_result else False,
        **result
    })
```

### Oppgave 2.2: Oppdater `forsering_service.py`
- Returner `event`-objektet sammen med result, slik at routes kan bruke det for Catenda-synk

---

## Del 3: Catenda-synkronisering for endringsordre (valgfritt)

Endringsordre opererer annerledes - de oppretter topics direkte i Catenda.
Men vi kan legge til event-logging og kommentarer for:

- `POST /endringsordre/opprett` → Post kommentar "Endringsordre opprettet"
- `POST /endringsordre/.../koe` → Post kommentar "KOE lagt til"
- `DELETE /endringsordre/.../koe/...` → Post kommentar "KOE fjernet"

**Vurdering:** Disse er mindre kritiske da EO-opprettelse allerede oppretter topic i Catenda.

---

## Del 4: Forbedret tilbakemelding til bruker

### Oppgave 4.1: Utvid API-respons

```typescript
interface EventSubmitResponse {
  success: boolean;
  event_id: string;
  new_version: number;

  // Catenda-status (ny)
  catenda_synced: boolean;
  catenda_skipped_reason?: 'no_topic_id' | 'not_authenticated' | 'error';
  catenda_error?: string;
}
```

### Oppgave 4.2: Frontend-varsel

**I `ForseringPage.tsx` og andre sider:**

```tsx
const mutation = useMutation({
  onSuccess: (result) => {
    if (!result.catenda_synced) {
      // Vis info-toast (ikke feil, bare info)
      toast.info(
        'Endringen er lagret, men ikke synkronisert til Catenda. ' +
        (result.catenda_skipped_reason === 'no_topic_id'
          ? 'Saken mangler Catenda-kobling.'
          : 'Sjekk Catenda-tilkobling.')
      );
    }
    // ... resten av success-håndtering
  }
});
```

---

## Del 5: Testplan

### Backend-tester
- [ ] `test_catenda_sync_service.py` - Enhetstester for ny service
- [ ] Oppdater `test_forsering_routes.py` med mock for Catenda-synk

### Integrasjonstester
- [ ] Verifiser at forsering BH-respons poster kommentar til Catenda
- [ ] Verifiser at forsering stopp poster kommentar
- [ ] Verifiser at kostnader-oppdatering poster kommentar
- [ ] Verifiser at manglende topic_id håndteres gracefully

### Frontend-tester
- [ ] Verifiser at info-toast vises når Catenda-synk hoppes over

---

## Implementeringsrekkefølge

1. **Del 1**: Refaktorer til `CatendaSyncService` (grunnarbeid)
2. **Del 2**: Forsering-endepunkter (høyest prioritet)
3. **Del 4**: Frontend-tilbakemelding (god UX)
4. **Del 3**: Endringsordre (lavere prioritet, fungerer allerede delvis)
5. **Del 5**: Tester

---

## Avhengigheter

- `CatendaCommentGenerator` må støtte forsering-events (verifiser)
- `metadata_repo.get_by_sak_id()` må være tilgjengelig i forsering_routes
- Frontend trenger toast/notification-system (finnes dette?)
