# KOE Digitaliseringsprosjekt - Strukturert Forbedringsrapport

**Dato**: 2025-11-19
**Versjon**: 1.2
**Utarbeidet av**: LLM Review
**Sist oppdatert**: 2025-11-20

> **Merk**: Alle kommentarer i Catenda er synlige for både TE og BH. Samme lenke brukes for alle parter - tilgang styres av Entra ID i produksjon.

---

## Status: Implementerte forbedringer

**Implementert 2025-11-20:**

✅ **Forbedrede Catenda-kommentarer** (Pkt 1)
- Kommentarer inkluderer nå kategori, dato, og kravdetaljer
- Bedre kontekst og neste steg-veiledning
- Samme lenke brukes konsistent for alle

✅ **Fjernet duplikate send-knapper** (Pkt 2.2)
- Panel-knapper fjernet fra VarselPanel, KravKoePanel, BhSvarPanel
- Kun bottom bar-knappen (API-tilkoblet) beholdt

✅ **Forbedrede knappetekster** (Pkt 2.4)
- Hovedtekst + subtext med kontekst
- Viser beløp i knappetekst når relevant
- Indikerer hva som skjer etter klikk

✅ **Custom suksess-modal** (Pkt 2.6)
- Egen modal-komponent (ikke PktModal)
- Viser neste steg og tillater PDF-nedlasting
- Keyboard-støtte (Escape for å lukke)

✅ **Automatisk dato/signatur-populering** (Ny)
- Fjernet manuelle dato/signatur-felt fra UI
- GrunninfoPanel viser saksmetadata i read-only tabell
- KravKoePanel og BhSvarPanel viser innsendingsdato/signatur som informasjonsbokser
- Backend auto-populerer: opprettet_dato, opprettet_av, dato_varsel_sendt, dato_krav_sendt, for_entreprenor, dato_svar_bh, for_byggherre
- Demo-data fungerer fortsatt (pre-populerte verdier)
- Reduserer feilkilder og forenkler UX

---

## Executive Summary

**Overordnet vurdering**: Systemet er et solid proof-of-concept med god grunnarkitektur, men trenger finpussing for produksjonsklarhet.

**Modenhetsnivå**: 6.5/10 - Funksjonelt komplett, men mangler polering og robusthet

### Styrker
- Moderne, profesjonell UI med Oslo Kommune design system (Punkt)
- Fleksibel arkitektur med god separasjon mellom frontend/backend
- Omfattende Catenda API-integrasjon
- Type-safe React implementasjon

### Hovedutfordringer
1. **Sikkerhet**: Manglende webhook-validering og API-autentisering
2. **Kommunikasjon**: Inkonsekvent detaljnivå i Catenda-kommentarer
3. **UX**: Uklar status og prosessflyt for brukere
4. **Robusthet**: Begrenset feilhåndtering og retry-logikk

---

## 1. Catenda-kommunikasjon (Kommentarer)

### Nåværende tilstand

| Hendelse | Nåværende tekst | Vurdering |
|----------|----------------|-----------|
| Saksopprettelse | `✅ Sak opprettet i KOE-systemet.\n🆔 Sak-ID: {sak_id}\n\n👉 [Klikk her for å fylle ut varsel]({app_link})` | ✅ God - har CTA |
| Varsel sendt | `📨 Varsel om endring mottatt.` | ⚠️ For kort |
| KOE sendt | `📨 Krav om endringsordre (KOE) mottatt.` | ⚠️ Mangler kontekst |
| BH svar | `📨 Svar fra byggherre registrert.` | ⚠️ Mangler detaljer |

### Forbedrede kommentartekster

> **Viktig**: Samme lenke (`{base_url}?sakId={sak_id}`) brukes i alle kommentarer. Systemet bestemmer riktig modus basert på saksstatus.

#### 1. Ved saksopprettelse
```python
comment_text = (
    f"✅ **Ny KOE-sak opprettet**\n\n"
    f"📋 Sak-ID: `{sak_id}`\n"
    f"📅 Dato: {dato}\n"
    f"🏗️ Prosjekt: {prosjekt}\n\n"
    f"**Neste steg:** Entreprenør sender varsel\n"
    f"👉 [Åpne skjema]({base_url}?sakId={sak_id})"
)
```

#### 2. Ved varsel sendt
```python
comment_text = (
    f"📨 **Varsel om endring sendt**\n\n"
    f"📑 Kategori: {hovedkategori}\n"
    f"📅 Dato oppdaget: {dato_oppdaget}\n\n"
    f"**Neste steg:** Entreprenør spesifiserer krav\n"
    f"👉 [Åpne skjema]({base_url}?sakId={sak_id})"
)
```

#### 3. Ved KOE (krav) sendt
```python
comment_text = (
    f"📋 **Krav om endringsordre (KOE) sendt**\n\n"
    f"🔢 Revisjon: {revisjonsnr}\n"
    f"{'💰 Vederlag: ' + krevd_beløp + ' NOK' if har_vederlag else ''}\n"
    f"{'📆 Fristforlengelse: ' + antall_dager + ' dager' if har_frist else ''}\n\n"
    f"**Neste steg:** Byggherre svarer på krav\n"
    f"👉 [Åpne skjema]({base_url}?sakId={sak_id})\n\n"
    f"📎 PDF-vedlegg tilgjengelig under dokumenter"
)
```

#### 4. Ved BH svar
```python
comment_text = (
    f"✍️ **Svar fra byggherre**\n\n"
    f"**Beslutning:**\n"
    f"{'💰 Vederlag: ' + svar_status_tekst if har_vederlag else ''}\n"
    f"{'📆 Frist: ' + svar_frist_tekst if har_frist else ''}\n\n"
    f"{'**Neste steg:** Entreprenør sender revidert krav' if trenger_revisjon else '**Status:** Sak kan lukkes'}\n"
    f"👉 [Åpne skjema]({base_url}?sakId={sak_id})"
)
```

#### 5. Ny: Påminnelse ved manglende svar
```python
comment_text = (
    f"⏰ **Påminnelse: Svar venter**\n\n"
    f"📋 Sak-ID: `{sak_id}`\n"
    f"📅 Krav sendt: {dato_krav}\n"
    f"⏳ Dager siden: {dager_siden}\n\n"
    f"**Venter på:** {rolle_som_venter}\n\n"
    f"👉 [{action_tekst}]({link})\n\n"
    f"_NS 8407 krever svar innen rimelig tid_"
)
```

---

## 2. React App Grensesnitt

### Designvurdering: Moderne app vs. tradisjonelt skjema

**Dilemma**: Skal skjemaet ligne mer på et tradisjonelt Word-/papirskjema som brukerne kjenner?

| Aspekt | Nåværende (moderne app) | Alternativ (Word-lignende) |
|--------|------------------------|---------------------------|
| **Layout** | En kolonne, mye whitespace | Tabeller, flere kolonner, kompakt |
| **Skriftstørrelse** | Standard (16px) | Mindre (12-14px) |
| **Feltplassering** | Vertikalt stablet | Horisontalt gruppert (2-3 per rad) |
| **Metadata** | Separate felt | Tabell-format |
| **Gjenkjennelighet** | Moderne, men uvant | Kjent for TE/BH |

**Anbefaling**: Hybrid tilnærming

```tsx
// Eksempel: Metadata som tabell (Word-lignende)
<table className="w-full text-sm border-collapse">
  <tbody>
    <tr>
      <td className="border px-2 py-1 bg-gray-50 font-medium w-1/4">Sak-ID</td>
      <td className="border px-2 py-1 w-1/4">{sakId}</td>
      <td className="border px-2 py-1 bg-gray-50 font-medium w-1/4">Prosjekt</td>
      <td className="border px-2 py-1 w-1/4">{prosjekt}</td>
    </tr>
    <tr>
      <td className="border px-2 py-1 bg-gray-50 font-medium">Entreprenør</td>
      <td className="border px-2 py-1">{te_navn}</td>
      <td className="border px-2 py-1 bg-gray-50 font-medium">Byggherre</td>
      <td className="border px-2 py-1">{bh_navn}</td>
    </tr>
  </tbody>
</table>

// Eksempel: To felt per rad for korte verdier
<div className="grid grid-cols-2 gap-4">
  <InputField label="Dato oppdaget" value={dato} />
  <InputField label="Revisjonsnr" value={rev} />
</div>

// Eksempel: Full bredde for textarea
<div className="col-span-2">
  <TextareaField label="Begrunnelse" value={begrunnelse} />
</div>
```

**Konkrete forslag**:

1. **Metadata-seksjon**: Bruk tabell-format for grunninfo (sak-ID, prosjekt, parter)
2. **Korte felt**: 2 per rad (dato, beløp, antall dager)
3. **Lange felt**: Full bredde (beskrivelser, begrunnelser)
4. **Skriftstørrelse**: Reduser til 14px for feltinnhold
5. **Bredere skjema**: Øk max-width fra 5xl til 6xl eller 7xl

```tsx
// Øk skjemabredde i App.tsx
<div className="max-w-6xl mx-auto ...">  // Fra max-w-5xl
```

**Vurder også**: Print-CSS som gjør at utskrift ligner tradisjonelt skjema.

---

### Kritiske forbedringer

#### 2.1 Visuell statusindikator/tidslinje (TOP PRIORITET)

**Problem**: Brukere forstår ikke hvor i prosessen de er.

**Løsning**: Legg til progress stepper i toppen av skjemaet.

```tsx
// Ny komponent: ProcessStepper.tsx
const ProcessStepper = ({ currentStep, rolle }) => {
  const steps = [
    { id: 1, label: 'Opprett sak', icon: 'information' },
    { id: 2, label: 'Send varsel', icon: 'flag' },
    { id: 3, label: 'Spesifiser krav', icon: 'invoice' },
    { id: 4, label: 'BH svarer', icon: 'signature', actor: 'BH' },
    { id: 5, label: 'Ferdig', icon: 'checkmark' }
  ];

  return (
    <div className="flex justify-between mb-8 px-4">
      {steps.map((step, i) => (
        <div key={step.id} className="flex flex-col items-center">
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center
            ${i < currentStep ? 'bg-green-600 text-white' :
              i === currentStep ? 'bg-blue-600 text-white animate-pulse' :
              'bg-gray-200 text-gray-500'}
          `}>
            <PktIcon name={step.icon} />
          </div>
          <span className="text-xs mt-2">{step.label}</span>
          {step.actor && <span className="text-xs text-gray-500">({step.actor})</span>}
        </div>
      ))}
    </div>
  );
};
```

#### 2.2 Fjern duplikate send-knapper (VIKTIG)

**Problem**: Det finnes to typer send-knapper som forvirrer brukere:

| Lokasjon | Knapp | Funksjon |
|----------|-------|----------|
| VarselPanel.tsx | "Send varsel og fortsett til krav" | Kun lokal state-oppdatering |
| KravKoePanel.tsx | "Send krav til byggherre" | Kun lokal state-oppdatering |
| BhSvarPanel.tsx | "Send svar til entreprenør" | Kun lokal state-oppdatering |
| App.tsx (bottom bar) | Dynamisk tekst | **Faktisk API-kall + PDF** |

**Løsning**: Fjern panel-knappene og behold kun bottom bar-knappen.

```tsx
// Fjern fra VarselPanel.tsx (linje 307-318)
// Fjern fra KravKoePanel.tsx (linje 281-289)
// Fjern fra BhSvarPanel.tsx (linje 302-310)

// Alternativt: Endre panel-knapper til "Lagre og fortsett" uten API-kall
<PktButton
  skin="secondary"
  onClick={() => {
    // Kun validering og tab-bytte, ingen API
    if (validateCurrentTab()) {
      setActiveTab(activeTab + 1);
    }
  }}
>
  Fortsett til neste steg
</PktButton>
```

#### 2.3 Utkast-synlighet (skjul fra motpart)

**Problem**: Når sak lastes, ser begge parter alle data inkludert utkast.

**Løsning**: Backend filtrerer ut utkast basert på modus.

```python
# backend/app.py - i get_case endpoint
@app.route('/api/cases/<sakId>', methods=['GET'])
def get_case(sakId):
    modus = request.args.get('modus')
    form_data = load_form_data(sakId)

    # Skjul utkast fra motpart
    if modus == 'svar':  # BH ser ikke TE sine utkast
        form_data['koe_revisjoner'] = [
            k for k in form_data['koe_revisjoner']
            if k.get('status') != '100000001'  # Ikke utkast
        ]
    elif modus in ['koe', 'varsel', 'revidering']:  # TE ser ikke BH sine utkast
        form_data['bh_svar_revisjoner'] = [
            s for s in form_data['bh_svar_revisjoner']
            if s.get('status') != '300000001'  # Ikke utkast
        ]

    return jsonify({'success': True, 'formData': form_data})
```

#### 2.4 Forbedrede knappetekster

**Nåværende**: Generiske "Send varsel", "Send krav"

**Forbedret**:

```tsx
const getSubmitButtonConfig = (modus: string, formData: FormDataModel) => {
  switch (modus) {
    case 'varsel':
      return {
        text: 'Send varsel til BH',
        subtext: 'Byggherre varsles automatisk',
        icon: 'send'
      };
    case 'koe':
      const beløp = formData.koe_revisjoner[sisteIndex]?.vederlag?.krevd_beløp;
      return {
        text: `Send krav ${beløp ? `(${beløp} NOK)` : ''}`,
        subtext: 'PDF genereres og sendes til BH',
        icon: 'invoice'
      };
    case 'svar':
      return {
        text: 'Send svar til TE',
        subtext: formData.bh_svar_revisjoner[sisteIndex]?.vederlag?.svar === '100000004'
          ? '✅ Godkjenner krav'
          : '⚠️ Krever revisjon',
        icon: 'signature'
      };
    case 'revidering':
      return {
        text: `Send revisjon ${Number(sisteRevisjon) + 1}`,
        subtext: 'Oppdatert krav sendes til BH',
        icon: 'refresh'
      };
  }
};
```

#### 2.5 Revisjonsoversikt med tidslinje

**Problem**: Vanskelig å se historikk og sammenligne revisjoner.

```tsx
// Ny komponent: RevisionTimeline.tsx
const RevisionTimeline = ({ koeRevisjoner, bhSvarRevisjoner }) => {
  // Flett sammen til kronologisk liste
  const events = mergeAndSort(koeRevisjoner, bhSvarRevisjoner);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Revisjonshistorikk</h3>
      {events.map((event, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full ${
              event.type === 'koe' ? 'bg-blue-500' : 'bg-purple-500'
            }`} />
            {i < events.length - 1 && <div className="w-0.5 h-full bg-gray-200" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex justify-between">
              <span className="font-medium">
                {event.type === 'koe' ? `Krav rev. ${event.nr}` : `BH svar ${event.nr}`}
              </span>
              <span className="text-sm text-gray-500">{event.dato}</span>
            </div>
            <PktTag skin={getStatusSkin(event.status)}>
              {getStatusLabel(event.status)}
            </PktTag>
            {event.beløp && <span className="text-sm ml-2">{event.beløp} NOK</span>}
          </div>
        </div>
      ))}
    </div>
  );
};
```

#### 2.6 Forbedret loading og feedback

```tsx
// Suksess-modal etter innsending
const SubmitSuccessModal = ({ isOpen, result }) => (
  <PktModal isOpen={isOpen} onClose={() => {}}>
    <div className="text-center p-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <PktIcon name="checkmark" className="text-green-600 text-3xl" />
      </div>
      <h2 className="text-xl font-semibold mb-2">
        {result.type === 'varsel' ? 'Varsel sendt!' :
         result.type === 'koe' ? 'Krav sendt!' : 'Svar sendt!'}
      </h2>
      <p className="text-gray-600 mb-4">{result.message}</p>

      <div className="bg-gray-50 rounded p-4 mb-4 text-left">
        <p className="text-sm"><strong>Neste steg:</strong></p>
        <p className="text-sm">{result.nextStep}</p>
      </div>

      {result.pdfUrl && (
        <a href={result.pdfUrl} className="text-blue-600 underline text-sm">
          📎 Last ned PDF-kopi
        </a>
      )}
    </div>
  </PktModal>
);
```

---

## 3. Integrasjon og Datakvalitet

### Kritiske forbedringer

#### 3.1 Webhook-signatur validering (KRITISK)

```python
# backend/app.py

import hmac
import hashlib

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verifiser at webhook kommer fra Catenda."""
    expected = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)

@app.route('/webhook/catenda', methods=['POST'])
def webhook():
    # Hent signatur fra header
    signature = request.headers.get('X-Catenda-Signature', '')
    webhook_secret = config.get('catenda_webhook_secret', '')

    # Verifiser signatur
    if webhook_secret and not verify_webhook_signature(
        request.data, signature, webhook_secret
    ):
        logger.warning(f"Ugyldig webhook-signatur fra {request.remote_addr}")
        return jsonify({"error": "Invalid signature"}), 401

    # Fortsett med eksisterende logikk...
```

#### 3.2 Retry-logikk for kritiske operasjoner

```python
# backend/app.py

import time
from functools import wraps

def retry_on_failure(max_retries=3, backoff_factor=2):
    """Decorator for exponential backoff retry."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (requests.RequestException, ConnectionError) as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        wait_time = backoff_factor ** attempt
                        logger.warning(
                            f"{func.__name__} feilet (forsøk {attempt + 1}), "
                            f"prøver igjen om {wait_time}s: {e}"
                        )
                        time.sleep(wait_time)

            logger.error(f"{func.__name__} feilet etter {max_retries} forsøk")
            raise last_exception
        return wrapper
    return decorator

# Bruk på kritiske API-kall
@retry_on_failure(max_retries=3)
def create_comment(self, topic_guid: str, comment_text: str):
    return self.catenda.create_comment(topic_guid, comment_text)
```

#### 3.3 Token-refresh automatikk

```python
# backend/catenda_api_tester.py

def _ensure_valid_token(self):
    """Sjekk og forny token om nødvendig."""
    if not self.access_token:
        raise AuthenticationError("Ingen access token satt")

    # Sjekk om token snart utløper (5 min buffer)
    if self.token_expiry and datetime.now() >= self.token_expiry - timedelta(minutes=5):
        if self.refresh_token:
            logger.info("Token utløper snart, fornyer...")
            self._refresh_access_token()
        else:
            logger.warning("Token utløper og ingen refresh_token tilgjengelig")

def _refresh_access_token(self):
    """Forny access token med refresh token."""
    response = requests.post(
        f"{self.base_url}/oauth2/token",
        data={
            'grant_type': 'refresh_token',
            'refresh_token': self.refresh_token,
            'client_id': self.client_id
        }
    )

    if response.status_code == 200:
        data = response.json()
        self.access_token = data['access_token']
        self.token_expiry = datetime.now() + timedelta(seconds=data['expires_in'])
        if 'refresh_token' in data:
            self.refresh_token = data['refresh_token']
        logger.info("Token fornyet")
    else:
        raise AuthenticationError(f"Kunne ikke fornye token: {response.text}")
```

#### 3.4 Forbedret audit trail

```python
# backend/app.py

import json
from datetime import datetime

class AuditLogger:
    def __init__(self, log_file='audit.log'):
        self.log_file = log_file

    def log(self, action: str, sak_id: str, user: str, details: dict, success: bool):
        entry = {
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'sak_id': sak_id,
            'user': user,
            'success': success,
            'details': details,
            'ip': request.remote_addr if request else None
        }

        with open(self.log_file, 'a') as f:
            f.write(json.dumps(entry) + '\n')

        # Også logg til standard logger
        log_fn = logger.info if success else logger.error
        log_fn(f"AUDIT: {action} | sak={sak_id} | success={success}")

audit = AuditLogger()

# Bruk i endpoints
@app.route('/api/koe-submit', methods=['POST'])
def submit_koe():
    data = request.get_json()
    result = sys.handle_koe_submit(...)

    audit.log(
        action='KOE_SUBMIT',
        sak_id=data.get('sakId'),
        user=data.get('formData', {}).get('sak', {}).get('opprettet_av', 'ukjent'),
        details={'revisjon': data.get('formData', {}).get('koe_revisjoner', [{}])[-1].get('koe_revisjonsnr')},
        success=result.get('success', False)
    )

    return jsonify(result)
```

---

## 4. Prioritert Forbedringsplan

### Kritiske forbedringer (Må fikses)

| # | Forbedring | Kompleksitet | Estimat | Påvirkning | Status |
|---|------------|-------------|---------|-----------|--------|
| ~~1~~ | ~~Fjern duplikate send-knapper~~ | ~~Lav~~ | ~~1t~~ | ~~UX/Klarhet~~ | ✅ **Implementert** |
| 2 | Utkast-synlighet filtrering | Lav | 2t | Sikkerhet/UX | Gjenstår |
| 3 | Webhook-signatur validering | Lav | 2t | Sikkerhet | Gjenstår |
| ~~4~~ | ~~Forbedrede Catenda-kommentarer~~ | ~~Lav~~ | ~~3t~~ | ~~Profesjonalitet~~ | ✅ **Implementert** |
| 5 | Token-refresh automatikk | Medium | 3t | Robusthet | Gjenstår |

### Viktige forbedringer (Bør fikses)

| # | Forbedring | Kompleksitet | Estimat | Påvirkning |
|---|------------|-------------|---------|-----------|
| 6 | Visuell statusindikator/stepper | Medium | 4t | UX |
| 7 | Retry-logikk for API-kall | Medium | 3t | Robusthet |
| 8 | Suksess-modal etter innsending | Medium | 3t | UX |
| 9 | Revisjonsoversikt tidslinje | Medium | 4t | UX |
| 10 | Audit trail logging | Medium | 3t | Sporbarhet |
| 11 | Filvalidering (størrelse/type) | Lav | 2t | Datakvalitet |
| 12 | API rate-limiting | Medium | 3t | Sikkerhet |

### Nice-to-have forbedringer

| # | Forbedring | Kompleksitet | Estimat | Påvirkning |
|---|------------|-------------|---------|-----------|
| 13 | Real-time felt-validering | Høy | 6t | UX |
| 14 | Offline queue med sync | Høy | 8t | Robusthet |
| 15 | Side-by-side revisjon diff | Høy | 6t | UX |
| 16 | PDF preview før sending | Medium | 4t | UX |
| 17 | Unit tests for utils | Medium | 4t | Kvalitet |
| 18 | E2E tests for workflows | Høy | 8t | Kvalitet |
| 19 | NS 8407 kontekst-hjelp | Medium | 4t | Brukervennlighet |
| 20 | Påminnelses-kommentarer | Medium | 3t | Profesjonalitet |

---

## 5. Implementeringsveiledning

### Fase 1: Kritisk opprydding (Dag 1-2)
1. ~~Fjern duplikate send-knapper fra paneler~~ ✅ **Ferdig**
2. Implementer utkast-synlighet filtrering i backend
3. ~~Oppdater Catenda-kommentarer med mer kontekst~~ ✅ **Ferdig**

### Fase 2: Sikkerhet og Robusthet (Uke 1)
4. Webhook-signatur validering
5. Token-refresh automatikk
6. Retry-logikk for API-kall
7. Filvalidering

### Fase 3: UX Forbedringer (Uke 2)
8. Visuell statusindikator/stepper
9. Suksess-modal etter innsending
10. Revisjonsoversikt tidslinje

### Fase 4: Sporbarhet og Kvalitet (Uke 3)
11. Audit trail logging
12. API rate-limiting
13. Unit tests for utils

---

## Konklusjon

Systemet har solid grunnarkitektur og god funksjonalitet for et PoC. Med de kritiske forbedringene implementert vil det fremstå betydelig mer profesjonelt og pålitelig.

**Implementert (2025-11-20):**
1. ~~Fjern duplikate send-knapper (klarhet for brukere)~~ ✅
2. ~~Oppdater Catenda-kommentarer med mer kontekst~~ ✅
3. ~~Forbedrede knappetekster med subtext~~ ✅
4. ~~Custom suksess-modal med neste steg-veiledning~~ ✅

**Prioritering for neste iterasjon:**
1. Utkast-synlighet filtrering (skjul utkast fra motpart)
2. Webhook-signatur validering
3. Token-refresh automatikk

**Eksisterende styrker som beholdes:**
- Tydelig banner med sak-ID, modus og status (allerede implementert)
- Samme lenke for alle parter (tilgang styres av Entra ID i produksjon)
- PDF genereres automatisk ved hver innsending

**Estimert total tid**: 45-55 timer for alle kritiske og viktige forbedringer.

Systemet demonstrerer allerede godt hvordan en papirbasert prosess kan digitaliseres. Med disse forbedringene vil det være klart for pilotbruk.
