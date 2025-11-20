# Guide: Forhåndsutfyll skjema fra Catenda Webhook

## Konsept

Når en webhook mottas fra Catenda, inneholder payload'en data om topic'en som kan brukes til å forhåndsutfylle KOE-skjemaet.

## Webhook Payload Eksempel

```json
{
  "event": {
    "type": "issue.created"
  },
  "project_id": "abc123",
  "issue": {
    "guid": "topic-guid-123",
    "title": "Endring av støyskjerm - E18 Langangen",
    "creation_author": "ola.nordmann@skanska.no",
    "creation_date": "2024-11-19T10:30:00Z",
    "description": "Vi må endre høyden på støyskjermen pga. terrengendringer",
    "labels": ["Endring", "Støyskjerm"],
    "assigned_to": "per.hansen@oslobygg.no",
    "priority": "Normal",
    "due_date": "2024-12-15",
    "topic_type": "Issue",
    "topic_status": "Open",

    // Custom fields (hvis konfigurert i Catenda)
    "custom_fields": {
      "prosjekt": "E18 Langangen-Rugtvedt",
      "prosjektnummer": "PRJ-2024-001",
      "entreprenor_firma": "Skanska AS",
      "byggherre_firma": "Oslobygg KF",
      "kategori": "Endring initiert av BH (§31.1)"
    }
  }
}
```

## Implementering i Backend

### Steg 1: Utvid `handle_new_topic_created` i `app.py`

```python
def handle_new_topic_created(self, webhook_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Oppretter sak og forhåndsutfyller skjema med webhook-data.
    """
    try:
        topic_data = webhook_payload.get('issue', {}) or webhook_payload.get('topic', {})
        topic_id = topic_data.get('id') or topic_data.get('guid')
        title = topic_data.get('title', 'Uten tittel')
        project_id = webhook_payload.get('project_id')
        board_id = topic_data.get('boardId') or topic_data.get('topic_board_id')

        if not topic_id:
            return {'success': False, 'error': 'Mangler topic ID'}

        # 1. Opprett sak i database (som før)
        sak_data = {
            'catenda_topic_id': topic_id,
            'catenda_project_id': project_id,
            'catenda_board_id': board_id,
            'sakstittel': title,
            'te_navn': topic_data.get('creation_author', 'Ukjent')
        }
        sak_id = self.db.create_sak(sak_data)

        # *** NY KODE: Initialiser form_data med webhook-data ***
        form_data = self._initialize_form_data_from_webhook(
            sak_id,
            topic_data,
            webhook_payload
        )

        # Lagre form_data til JSON
        self.db.save_form_data(sak_id, form_data)
        logger.info(f"Form data initialisert med webhook-data for sak {sak_id}")

        # 2. Generer lenke og post kommentar (som før)
        base_url = self.config.get('react_app_url', 'http://localhost:5173')
        app_link = f"{base_url}?sakId={sak_id}&modus=varsel&topicGuid={topic_id}"

        comment_text = (
            f"✅ Sak opprettet i KOE-systemet.\n"
            f"🆔 Sak-ID: {sak_id}\n\n"
            f"👉 [Klikk her for å fylle ut varsel]({app_link})"
        )

        self.catenda.topic_board_id = board_id
        self.catenda.create_comment(topic_id, comment_text)
        logger.info(f"✅ Sak {sak_id} opprettet og lenke sendt til Catenda.")

        return {'success': True, 'sak_id': sak_id}

    except Exception as e:
        logger.exception(f"Feil i handle_new_topic_created: {e}")
        return {'success': False, 'error': str(e)}
```

### Steg 2: Legg til hjelpemetode `_initialize_form_data_from_webhook`

```python
def _initialize_form_data_from_webhook(
    self,
    sak_id: str,
    topic_data: Dict[str, Any],
    webhook_payload: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Mapper webhook-data til form_data-struktur.
    """
    from datetime import datetime

    # Hent custom fields hvis de finnes
    custom_fields = topic_data.get('custom_fields', {})

    # Ekstraher relevante felt
    title = topic_data.get('title', '')
    description = topic_data.get('description', '')
    creation_author = topic_data.get('creation_author', '')
    creation_date = topic_data.get('creation_date', datetime.now().isoformat())
    assigned_to = topic_data.get('assigned_to', '')

    # Parse dato (ISO 8601 → YYYY-MM-DD)
    try:
        created_date_obj = datetime.fromisoformat(creation_date.replace('Z', '+00:00'))
        created_date_str = created_date_obj.strftime('%Y-%m-%d')
    except:
        created_date_str = datetime.now().strftime('%Y-%m-%d')

    # Bygg form_data-struktur
    form_data = {
        "versjon": "5.0",
        "rolle": "TE",
        "sak": {
            "sakstittel": title,
            "sak_id": sak_id,
            "opprettet_av": creation_author,
            "opprettet_dato": created_date_str,

            # Prøv å mappe fra custom fields
            "prosjekt": custom_fields.get('prosjekt', ''),
            "prosjektnummer": custom_fields.get('prosjektnummer', ''),
            "te_navn": custom_fields.get('entreprenor_firma', creation_author),
            "bh_navn": custom_fields.get('byggherre_firma', assigned_to),

            "status": "100000000"  # Under varsling
        },
        "varsel": {
            "dato_forhold_oppdaget": created_date_str,  # Kan justeres av bruker

            # Prøv å mappe kategori fra custom field eller labels
            "hovedkategori": custom_fields.get('kategori', ''),
            "underkategori": [],

            # Forhåndsutfyll beskrivelse fra Catenda-beskrivelse
            "beskrivelse": description,

            "tidligere_varslet": "nei",
            "varsel_metode": "",
            "dato_varsel_sendt": "",
            "vedlegg": []
        },
        "koe_revisjoner": [
            {
                "koe_revisjonsnr": "0",
                "dato_krav_sendt": "",
                "vederlag": {
                    "krav_vederlag": False,
                    "inkluderer_produktivitetstap": False,
                    "saerskilt_varsel_rigg_drift": False,
                    "oppgjorsmetode": "",
                    "krevd_belop": "",
                    "begrunnelse_vederlag": ""
                },
                "frist": {
                    "krav_fristforlengelse": False,
                    "type_fristkrav": "",
                    "antall_dager": "",
                    "pavirker_kritisk_linje": False,
                    "begrunnelse_frist": ""
                },
                "sign": {
                    "dato_krav_sendt": "",
                    "for_entreprenor": ""
                },
                "status": "100000001",  # Utkast
                "vedlegg": []
            }
        ],
        "bh_svar_revisjoner": []
    }

    return form_data
```

### Steg 3: Valgfritt - Mapping-konfigurasjon

Hvis Catenda custom fields har andre navn, legg til mapping i `config.json`:

```json
{
  "catenda_client_id": "...",
  "catenda_field_mapping": {
    "prosjekt": "custom_fields.project_name",
    "prosjektnummer": "custom_fields.project_number",
    "te_navn": "custom_fields.contractor",
    "bh_navn": "custom_fields.client",
    "hovedkategori": "labels.0"
  }
}
```

Og utvid `_initialize_form_data_from_webhook`:

```python
def _get_mapped_value(self, topic_data: dict, mapping_path: str) -> str:
    """
    Henter verdi basert på mapping-path, f.eks. 'custom_fields.project_name'
    """
    keys = mapping_path.split('.')
    value = topic_data

    for key in keys:
        if isinstance(value, dict):
            value = value.get(key, '')
        elif isinstance(value, list) and key.isdigit():
            idx = int(key)
            value = value[idx] if idx < len(value) else ''
        else:
            return ''

    return str(value) if value else ''

def _initialize_form_data_from_webhook(self, sak_id, topic_data, webhook_payload):
    # ... (som før)

    # Bruk mapping hvis konfigurert
    field_mapping = self.config.get('catenda_field_mapping', {})

    prosjekt = (
        self._get_mapped_value(topic_data, field_mapping.get('prosjekt', ''))
        if field_mapping.get('prosjekt')
        else custom_fields.get('prosjekt', '')
    )

    # ... osv for andre felt
```

## Frontend-håndtering

Frontend trenger ingen endringer! Når brukeren åpner lenken:

```
https://app.url?sakId={sak_id}&modus=varsel
```

1. `App.tsx` kaller `GET /api/cases/{sakId}`
2. Backend returnerer `form_data` med forhåndsutfylte verdier
3. React-skjemaet viser verdiene automatisk

Brukeren kan redigere alle felt som vanlig.

## Testing

### 1. Test webhook lokalt med curl

```bash
curl -X POST http://localhost:8080/webhook/catenda \
  -H "Content-Type: application/json" \
  -d '{
    "event": {"type": "issue.created"},
    "project_id": "test-project",
    "issue": {
      "guid": "test-topic-123",
      "title": "Test endring",
      "creation_author": "test@example.com",
      "description": "Dette er en test-beskrivelse",
      "custom_fields": {
        "prosjekt": "Testprosjekt",
        "prosjektnummer": "TEST-001",
        "entreprenor_firma": "Test Entreprenør AS",
        "byggherre_firma": "Test Byggherre KF"
      }
    }
  }'
```

### 2. Sjekk at form_data er opprettet

```bash
# Finn sak-ID fra backend-respons
cat backend/data/form_data/{sak_id}.json | jq .
```

Forventet output:
```json
{
  "versjon": "5.0",
  "sak": {
    "sakstittel": "Test endring",
    "prosjekt": "Testprosjekt",
    "te_navn": "Test Entreprenør AS",
    ...
  },
  "varsel": {
    "beskrivelse": "Dette er en test-beskrivelse",
    ...
  }
}
```

### 3. Test i frontend

Åpne `http://localhost:5173?sakId={sak_id}&modus=varsel`

Verifiser at:
- Sakstittel er forhåndsutfylt
- Prosjektinfo er forhåndsutfylt
- Varselbeskrivelse inneholder Catenda-beskrivelsen

## Viktige poeng

1. **Partial prefill**: Forhåndsutfyller bare felt som har data i webhook
2. **Brukeren kan overskrive**: Alt kan endres i UI
3. **Validering**: Vær forsiktig med å stole på webhook-data - valider fortsatt i frontend
4. **Null-sjekk**: Bruk `.get()` med default-verdier for å unngå KeyError

## Alternativ: Asynkron uthenting

Hvis Catenda topic ikke har all data i webhook, men du vil hente mer:

```python
def _enrich_form_data_from_catenda(self, topic_guid: str, form_data: dict) -> dict:
    """
    Henter ekstra data fra Catenda API for å berike form_data.
    """
    try:
        # Hent full topic-detaljer
        topic_details = self.catenda.get_topic(self.catenda.topic_board_id, topic_guid)

        # Hent kommentarer
        comments = self.catenda.get_comments(topic_guid)

        # Berik form_data med ekstra info
        if comments:
            first_comment = comments[0].get('comment', '')
            form_data['varsel']['beskrivelse'] += f"\n\nFra Catenda: {first_comment}"

        return form_data
    except Exception as e:
        logger.warning(f"Kunne ikke berike form_data: {e}")
        return form_data
```

Dette gir deg full kontroll over hvilke data som prefilles!
