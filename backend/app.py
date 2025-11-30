#!/usr/bin/env python3
"""
KOE Automation System - Backend API
Fungerer som bindeledd mellom Catenda og React Frontend.

Funksjonalitet:
1. Webhook: Oppdager nye saker i Catenda -> Oppretter sak -> Sender lenke til React App.
2. Webhook: Oppdager endringer (status/kommentar) -> Oppdaterer intern status.
3. API: Tar imot skjemadata fra React -> Lagrer JSON -> Oppdaterer status.
4. API: Tar imot generert PDF fra React -> Laster opp til Catenda.
"""

import os
import sys
import json
import csv
import logging
import base64
import tempfile
import socket
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from threading import RLock, Thread

# Last .env fil (VIKTIG for sikkerhetsvariabler)
from dotenv import load_dotenv
load_dotenv()

# Import constants
from constants import (
    SAK_STATUS, KOE_STATUS, BH_SVAR_STATUS,
    BH_VEDERLAG_SVAR, BH_FRIST_SVAR,
    get_vederlag_svar_label, get_frist_svar_label,
    krever_revisjon
)

# Flask og CORS
try:
    from flask import Flask, request, jsonify, g
    from flask_cors import CORS
except ImportError:
    print("❌ Flask eller Flask-Cors ikke installert. Kjør: pip install flask flask-cors")
    sys.exit(1)

# Catenda API
try:
    from catenda_api_tester import CatendaAPITester
except ImportError:
    print("❌ Finner ikke catenda_api_tester.py")
    sys.exit(1)

# Filtering imports
try:
    from filtering_config import should_process_topic, get_filter_summary
except ImportError:
    print("❌ Finner ikke filtering_config.py")
    sys.exit(1)

# Security modules
try:
    from csrf_protection import generate_csrf_token, require_csrf
    from validation import (
        validate_guid, validate_csv_safe_string, ValidationError,
        validate_sak_status, validate_positive_number, validate_date_string
    )
    from catenda_auth import require_catenda_auth, require_project_access, validate_field_access
    from webhook_security import (
        validate_webhook_token, is_duplicate_event,
        validate_webhook_event_structure, get_webhook_event_id
    )
    from audit import audit
except ImportError as e:
    print(f"⚠️  Sikkerh​etsmoduler ikke funnet: {e}")
    print("   Fortsetter uten sikkerhetsfunksjoner (kun for utvikling)")
    # Define dummy decorators hvis modulene mangler
    def require_csrf(f): return f
    def require_catenda_auth(f): return f
    def require_project_access(f): return f
    class audit:
        @staticmethod
        def log_event(*args, **kwargs): pass
        @staticmethod
        def log_auth_success(*args, **kwargs): pass
        @staticmethod
        def log_auth_failure(*args, **kwargs): pass
        @staticmethod
        def log_access_denied(*args, **kwargs): pass
        @staticmethod
        def log_webhook_received(*args, **kwargs): pass
        @staticmethod
        def log_security_event(*args, **kwargs): pass

# Konfigurer logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('koe_automation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def get_local_ip():
    """Henter maskinens lokale nettverks-IP."""
    s = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Trenger ikke være nåelig, brukes kun for å finne utgående IP
        s.connect(('8.8.8.8', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1' # Fallback til localhost
    finally:
        if s:
            s.close()
    return IP

class DataManager:
    """
    Håndterer datalagring:
    - CSV for oversikt (saker, historikk)
    - JSON for detaljert skjemadata (per sak)
    """
    SAKER_FIELDNAMES = [
        'sak_id', 'catenda_topic_id', 'catenda_project_id', 'catenda_board_id',
        'sakstittel', 'opprettet_dato', 'opprettet_av', 'status', 'te_navn', 'modus',
        'byggherre', 'entreprenor', 'prosjekt_navn'
    ]
    HISTORIKK_FIELDNAMES = [
        'timestamp', 'sak_id', 'hendelse_type', 'beskrivelse'
    ]
    
    def __init__(self, data_dir: str = "koe_data"):
        self.data_dir = Path(data_dir)
        self.form_data_dir = self.data_dir / "form_data"
        
        self.data_dir.mkdir(exist_ok=True)
        self.form_data_dir.mkdir(exist_ok=True)
        
        # CSV-filer
        self.saker_file = self.data_dir / "saker.csv"
        self.historikk_file = self.data_dir / "historikk.csv"
        
        self.lock = RLock()  # Re-entrant lock for nested calls
        self._initialize_files()
    
    def _initialize_files(self):
        """Opprett CSV-filer med headers hvis de ikke finnes"""
        if not self.saker_file.exists():
            with open(self.saker_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=self.SAKER_FIELDNAMES)
                writer.writeheader()
        
        if not self.historikk_file.exists():
            with open(self.historikk_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=self.HISTORIKK_FIELDNAMES)
                writer.writeheader()

    def create_sak(self, sak_data: Dict[str, Any]) -> str:
        """Opprett ny sak i CSV og en tom JSON-fil"""
        with self.lock:
            if 'sak_id' not in sak_data:
                sak_data['sak_id'] = f"KOE-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

            sak_data.setdefault('opprettet_dato', datetime.now().isoformat())
            sak_data.setdefault('opprettet_av', sak_data.get('te_navn', 'System'))
            sak_data.setdefault('status', SAK_STATUS['UNDER_VARSLING'])
            sak_data.setdefault('modus', 'varsel')
            
            # Lagre til CSV
            with open(self.saker_file, 'a', newline='', encoding='utf-8') as f:
                # Filtrer slik at kun definerte felter skrives til CSV
                filtered_data = {k: sak_data.get(k) for k in self.SAKER_FIELDNAMES}
                writer = csv.DictWriter(f, fieldnames=self.SAKER_FIELDNAMES)
                writer.writerow(filtered_data)
            
            sak_data['sak_id_display'] = sak_data['sak_id']
            
            # Opprett initiell JSON-fil med første krav-revisjon
            initial_json = {
                "versjon": "5.0",
                "rolle": "TE",
                "sak": sak_data,
                "varsel": {},
                "koe_revisjoner": [
                    {
                        "koe_revisjonsnr": "0",
                        "dato_krav_sendt": "",
                        "for_entreprenor": "",
                        "status": KOE_STATUS['UTKAST'],
                        "vederlag": {
                            "krav_vederlag": False,
                            "krav_produktivitetstap": False,
                            "saerskilt_varsel_rigg_drift": False,
                            "krav_vederlag_metode": "",
                            "krav_vederlag_belop": "",
                            "krav_vederlag_begrunnelse": "",
                        },
                        "frist": {
                            "krav_fristforlengelse": False,
                            "krav_frist_type": "",
                            "krav_frist_antall_dager": "",
                            "forsinkelse_kritisk_linje": False,
                            "krav_frist_begrunnelse": "",
                        },
                    }
                ],
                "bh_svar_revisjoner": []
            }
            self.save_form_data(sak_data['sak_id'], initial_json)
            
            self.log_historikk(sak_data['sak_id'], 'sak_opprettet', 'Ny sak opprettet fra Catenda')
            return sak_data['sak_id']

    def save_form_data(self, sak_id: str, data: Dict[str, Any]):
        """Lagre detaljert skjemadata til JSON og synkroniser status/modus til CSV"""
        # Lagre til JSON
        file_path = self.form_data_dir / f"{sak_id}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Synkroniser status og modus fra sak-objektet til CSV
        sak_data = data.get('sak', {})
        if sak_data:
            status = sak_data.get('status')
            modus = sak_data.get('modus')
            if status or modus:
                self.update_sak_status(sak_id, status, modus)

    def get_form_data(self, sak_id: str) -> Optional[Dict[str, Any]]:
        """Hent skjemadata fra JSON"""
        file_path = self.form_data_dir / f"{sak_id}.json"
        if not file_path.exists():
            return None
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Feil ved lesing av JSON for {sak_id}: {e}")
            return None

    def get_sak_by_topic_id(self, topic_id: str) -> Optional[Dict[str, Any]]:
        """Finn sak basert på Catenda topic GUID"""
        with self.lock:
            with open(self.saker_file, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['catenda_topic_id'] == topic_id:
                        return row
        return None

    def update_sak_status(self, sak_id: str, status: str, modus: Optional[str] = None):
        """Oppdater status og eventuelt modus i CSV"""
        with self.lock:
            rows = []
            updated = False
            fieldnames = self.SAKER_FIELDNAMES
            with open(self.saker_file, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                for row in reader:
                    if row['sak_id'] == sak_id:
                        if status:
                            row['status'] = status
                        if modus:
                            row['modus'] = modus
                        updated = True
                    rows.append(row)
            
            if updated:
                with open(self.saker_file, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)

    def log_historikk(self, sak_id: str, hendelse_type: str, beskrivelse: str):
        """Logg til historikk.csv"""
        with open(self.historikk_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=self.HISTORIKK_FIELDNAMES)
            writer.writerow({
                'timestamp': datetime.now().isoformat(),
                'sak_id': sak_id,
                'hendelse_type': hendelse_type,
                'beskrivelse': beskrivelse
            })

class KOEAutomationSystem:
    """Hovedsystem for logikk og Catenda-integrasjon"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db = DataManager(config.get('data_dir', 'koe_data'))
        self.catenda = CatendaAPITester(
            client_id=config['catenda_client_id'],
            client_secret=config.get('catenda_client_secret')
        )
        
        # Autentiser ved oppstart
        if not self._authenticate():
            logger.warning("⚠️ Kunne ikke autentisere mot Catenda ved oppstart.")

    def _authenticate(self) -> bool:
        """Enkel autentisering med lagret token eller client credentials"""
        access_token = self.config.get('catenda_access_token')
        if access_token:
            self.catenda.set_access_token(access_token)
            return True
        if self.config.get('catenda_client_secret'):
            return self.catenda.authenticate()
        return False

    def get_react_app_base_url(self) -> str:
        """Determines the correct base URL for the React application."""
        dev_url = os.environ.get('DEV_REACT_APP_URL')
        if dev_url:
            return dev_url
        if 'react_app_url' in self.config:
            return self.config['react_app_url']
        
        local_ip = get_local_ip()
        return f"http://{local_ip}:3000"

    def handle_new_topic_created(self, webhook_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fase 2: Håndterer ny topic.
        Oppretter sak, henter metadata, og poster lenke til React-app.
        """
        try:
            # Steg 1: Hent ID-er og sjekk filtre
            temp_topic_data = webhook_payload.get('issue', {}) or webhook_payload.get('topic', {})
            board_id = webhook_payload.get('project_id') or temp_topic_data.get('boardId') or temp_topic_data.get('topic_board_id')

            filter_data = temp_topic_data.copy()
            filter_data['board_id'] = board_id
            filter_data['type'] = temp_topic_data.get('topic_type') or temp_topic_data.get('type')

            should_proc, reason = should_process_topic(filter_data)
            if not should_proc:
                logger.info(f"⏭️  Ignorerer topic (årsak: {reason})")
                return {'success': True, 'action': 'ignored_due_to_filter', 'reason': reason}

            # Fortsett kun hvis filter er passert
            topic_id = temp_topic_data.get('id') or temp_topic_data.get('guid') or webhook_payload.get('guid')

            if not topic_id or not board_id:
                logger.error(f"Webhook mangler 'topic_id' eller 'board_id'. Payload: {webhook_payload}")
                return {'success': False, 'error': 'Mangler topic_id eller board_id i webhook'}

            # Steg 2: Hent fullstendig, oppdatert topic-data via API for en pålitelig datakilde
            self.catenda.topic_board_id = board_id
            topic_data = self.catenda.get_topic_details(topic_id)

            if not topic_data:
                logger.error(f"Klarte ikke å hente topic-detaljer for ID {topic_id} fra Catenda API.")
                return {'success': False, 'error': f'Kunne ikke hente topic-detaljer for {topic_id}'}

            title = topic_data.get('title', 'Uten tittel')

            # --- Utvidelse: Hent metadata for forhåndsutfylling ---
            byggherre = 'Ikke spesifisert'
            leverandor = 'Ikke spesifisert'
            saksstatus = SAK_STATUS['UNDER_VARSLING']
            project_name = 'Ukjent prosjekt'
            v2_project_id = None

            # Steg 2a: Hent v2 prosjekt-ID og navn fra Topic Board
            board_details = self.catenda.get_topic_board_details()
            if board_details:
                v2_project_id = board_details.get('bimsync_project_id')
                if v2_project_id:
                    project_details = self.catenda.get_project_details(v2_project_id)
                    if project_details:
                        project_name = project_details.get('name', project_name)

            # Steg 2b: Hent fra custom fields og forfatter
            custom_fields = topic_data.get('bimsync_custom_fields', [])
            for field in custom_fields:
                field_name = field.get('customFieldName')
                field_value = field.get('value')
                if field_name == 'Byggherre' and field_value:
                    byggherre = field_value
                elif field_name == 'Leverandør' and field_value:
                    leverandor = field_value
                elif field_name == 'Saksstatus KOE' and field_value:
                    saksstatus = field_value
            
            author_name = topic_data.get('bimsync_creation_author', {}).get('user', {}).get('name', topic_data.get('creation_author', 'Ukjent'))

            # Steg 3: Opprett sak i database med beriket data
            sak_data = {
                'catenda_topic_id': topic_id,
                'catenda_project_id': v2_project_id,
                'catenda_board_id': board_id,
                'sakstittel': title,
                'te_navn': author_name,
                'status': saksstatus,
                'byggherre': byggherre,
                'entreprenor': leverandor,
                'prosjekt_navn': project_name,
            }
            sak_id = self.db.create_sak(sak_data)
            
            # Steg 4: Generer Magic Link for tilgang til React App
            author_email = topic_data.get('bimsync_creation_author', {}).get('user', {}).get('email')
            magic_token = magic_link_mgr.generate(sak_id=sak_id, email=author_email)

            base_url = self.get_react_app_base_url()

            magic_link = f"{base_url}?magicToken={magic_token}"

            # Steg 5: Post kommentar til Catenda (asynkront for å unngå webhook deadlock)
            dato = datetime.now().strftime('%Y-%m-%d')
            comment_text = (
                f"✅ **Ny KOE-sak opprettet**\n\n"
                f"📋 Intern Sak-ID: `{sak_id}`\n"
                f"📅 Dato: {dato}\n"
                f"🏗️ Prosjekt: {project_name}\n\n"
                f"**Neste steg:** Entreprenør sender varsel\n"
                f"👉 [Åpne skjema]({magic_link})"
            )

            # Post kommentar i background thread for å unngå blokkering av webhook-respons
            def post_comment_async():
                try:
                    self.catenda.create_comment(topic_id, comment_text)
                    logger.info(f"✅ Kommentar sendt til Catenda for sak {sak_id}")
                except Exception as e:
                    logger.error(f"❌ Feil ved posting av kommentar til Catenda: {e}")

            Thread(target=post_comment_async, daemon=True).start()
            logger.info(f"✅ Sak {sak_id} opprettet, kommentar sendes i bakgrunnen.")

            return {'success': True, 'sak_id': sak_id}
            
        except Exception as e:
            logger.exception(f"Feil i handle_new_topic_created: {e}")
            return {'success': False, 'error': str(e)}

    def handle_topic_modification(self, webhook_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Håndterer endringer på topic (statusendring eller kommentar).
        Gjeninnført for å fange opp BH-respons direkte i Catenda.
        """
        try:
            topic_data = webhook_payload.get('issue', {}) or webhook_payload.get('topic', {})
            topic_id = topic_data.get('id') or topic_data.get('guid')
            
            # Finn sak
            sak = self.db.get_sak_by_topic_id(topic_id)
            if not sak:
                return {'success': True, 'action': 'ignored_unknown_topic'}
            
            sak_id = sak['sak_id']
            
            # Sjekk hva som er endret
            modification_data = webhook_payload.get('modification', {})
            comment_data = webhook_payload.get('comment', {})
            
            response_keyword = None
            new_status = None

            # 1. Statusendring
            if modification_data.get('event') == 'status_updated':
                new_status_val = modification_data.get('value', '').lower()
                logger.info(f"Status endret til: {new_status_val}")
                
                if 'lukket' in new_status_val or 'closed' in new_status_val:
                    new_status = 'Lukket'
                elif 'godkjent' in new_status_val:
                    new_status = 'Godkjent'
            
            # 2. Kommentar
            elif 'comment' in comment_data:
                comment_text = comment_data.get('comment', '').lower()
                if 'godkjent' in comment_text:
                    new_status = 'Godkjent'
                elif 'avslått' in comment_text or 'avvist' in comment_text:
                    new_status = 'Avslått'

            # Oppdater hvis vi fant en relevant endring
            if new_status:
                self.db.update_sak_status(sak_id, new_status)
                self.db.log_historikk(sak_id, 'catenda_oppdatering', f"Status oppdatert til {new_status} via Catenda")
                logger.info(f"✅ Sak {sak_id} oppdatert til {new_status} basert på Catenda-hendelse.")
                return {'success': True, 'action': 'updated', 'status': new_status}
            
            return {'success': True, 'action': 'no_change'}

        except Exception as e:
            logger.exception(f"Feil i handle_topic_modification: {e}")
            return {'success': False, 'error': str(e)}

    def handle_pdf_upload(self, sak_id: str, pdf_base64: str, filename: str, topic_guid: str) -> Dict[str, Any]:
        """
        Fase 4: Tar imot Base64 PDF, laster opp til Catenda og kobler til topic.
        """
        temp_path = None
        try:
            # 1. Dekode Base64 til fil
            pdf_data = base64.b64decode(pdf_base64)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                temp_file.write(pdf_data)
                temp_path = temp_file.name
            
            logger.info(f"PDF lagret midlertidig: {temp_path}")

            # 2. Last opp til Catenda
            project_id = self.config.get('catenda_project_id')
            library_id = self.config.get('catenda_library_id')
            
            if library_id:
                self.catenda.library_id = library_id
            else:
                self.catenda.select_library(project_id)

            doc_result = self.catenda.upload_document(project_id, temp_path, filename)
            
            if not doc_result or 'id' not in doc_result:
                raise Exception("Feil ved opplasting av dokument til Catenda")
            
            compact_doc_guid = doc_result['id']
            logger.info(f"PDF lastet opp til Catenda. Kompakt GUID: {compact_doc_guid}")

            # 3. Konverter GUID til standard UUID-format for BCF API
            if len(compact_doc_guid) == 32:
                formatted_doc_guid = (
                    f"{compact_doc_guid[:8]}-{compact_doc_guid[8:12]}-"
                    f"{compact_doc_guid[12:16]}-{compact_doc_guid[16:20]}-{compact_doc_guid[20:]}"
                )
            else:
                formatted_doc_guid = compact_doc_guid # Anta at formatet allerede er riktig

            # 4. Koble til Topic
            sak_info = self.db.get_form_data(sak_id)
            if sak_info and 'sak' in sak_info and sak_info['sak'].get('catenda_board_id'):
                 self.catenda.topic_board_id = sak_info['sak']['catenda_board_id']
                 logger.info(f"Bruker lagret board ID: {self.catenda.topic_board_id}")
            elif not self.catenda.topic_board_id:
                 logger.warning("Fant ikke board ID i sak, prøver default...")
                 self.catenda.select_topic_board(0)

            ref_result = self.catenda.create_document_reference(topic_guid, formatted_doc_guid)
            
            if ref_result:
                logger.info(f"PDF koblet til topic {topic_guid}")
                return {'success': True, 'documentGuid': formatted_doc_guid, 'filename': filename}
            else:
                # Hvis det feiler, logg forsøket med den kompakte ID-en også for feilsøking
                logger.warning(f"Kunne ikke koble med formatert GUID. Prøver kompakt GUID: {compact_doc_guid}")
                ref_result_compact = self.catenda.create_document_reference(topic_guid, compact_doc_guid)
                if ref_result_compact:
                    logger.info(f"PDF koblet til topic {topic_guid} med kompakt GUID.")
                    return {'success': True, 'documentGuid': compact_doc_guid, 'filename': filename}
                else:
                    return {'success': False, 'error': 'Kunne ikke koble dokument til topic (begge GUID-formater feilet)'}

        except Exception as e:
            logger.exception(f"Feil ved PDF-håndtering: {e}")
            return {'success': False, 'error': str(e)}
        finally:
            # Rydd opp
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

# --- Flask App Setup ---
app = Flask(__name__)

# CORS Configuration (forbedret sikkerhet)
# I produksjon: Begrens origins til faktiske domener
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
NGROK_URL = os.getenv("NGROK_URL", "")
if NGROK_URL:
    ALLOWED_ORIGINS.append(NGROK_URL)

CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-CSRF-Token", "Authorization"],
        "expose_headers": ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
        "supports_credentials": False,
        "max_age": 3600
    }
})

# Rate Limiting (beskytter mot overbelastning)
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"],
        storage_uri="memory://"  # In-memory for prototype
    )
    logger.info("✅ Rate limiting aktivert")
except ImportError:
    logger.warning("⚠️  Flask-Limiter ikke installert. Rate limiting deaktivert.")
    logger.warning("   Installer med: pip install Flask-Limiter")
    # Dummy limiter hvis ikke installert
    class limiter:
        @staticmethod
        def limit(limit_string):
            def decorator(f):
                return f
            return decorator

# Global system instance
system: Optional[KOEAutomationSystem] = None

def get_system():
    global system
    if system is None:
        try:
            with open('config.json', 'r') as f:
                config = json.load(f)
            system = KOEAutomationSystem(config)
            logger.info(f"System startet. {get_filter_summary()}")
        except Exception as e:
            logger.error(f"Kunne ikke starte systemet: {e}")
            sys.exit(1)
    return system

from magic_link import MagicLinkManager
magic_link_mgr = MagicLinkManager()

# --- Error Handlers ---

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handler for rate limit overskredet."""
    audit.log_security_event("rate_limit_exceeded", {
        "limit": str(e.description)
    })
    return jsonify({
        "error": "Rate limit exceeded",
        "detail": str(e.description),
        "retry_after": getattr(e, 'retry_after', 60)
    }), 429

@app.errorhandler(403)
def forbidden_handler(e):
    """Handler for tilgang nektet."""
    user = g.get('user', {})
    audit.log_access_denied(
        user=user.get('email', 'anonymous'),
        resource=request.path,
        reason=str(e)
    )
    return jsonify({"error": "Forbidden", "detail": str(e)}), 403

# --- API Endpoints (Fase 3) ---

@app.route('/api/csrf-token', methods=['GET'])
@limiter.limit("30 per minute")
def get_csrf_token():
    """
    Hent CSRF-token for å beskytte state-changing operations.

    CSRF (Cross-Site Request Forgery) beskytter mot at ondsinnede nettsider
    får brukerens browser til å utføre uønskede handlinger.

    Returns:
        JSON: {"csrfToken": "...", "expiresIn": 3600}
    """
    try:
        token = generate_csrf_token()
        return jsonify({
            "csrfToken": token,
            "expiresIn": 3600  # 1 time
        }), 200
    except Exception as e:
        logger.error(f"Feil ved generering av CSRF-token: {e}")
        return jsonify({"error": "Failed to generate CSRF token"}), 500

@app.route('/api/magic-link/verify', methods=['GET'])
def verify_magic_link():
    """
    Verifiserer et Magic Link token.
    Returnerer den interne sakId-en hvis token er gyldig.
    """
    token = request.args.get('token', '')
    valid, error, token_data = magic_link_mgr.verify(token)

    if not valid:
        return jsonify({"error": "Invalid or expired link", "detail": error}), 403

    return jsonify({
        "success": True,
        "sakId": token_data["sak_id"]
    }), 200


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "koe-backend"}), 200

@app.route('/api/validate-user', methods=['POST'])
def validate_user():
    """
    Validerer om en e-post tilhører en bruker i prosjektet
    og returnerer navnet.
    """
    sys = get_system()
    payload = request.get_json()
    email = payload.get('email')
    sak_id = payload.get('sakId')

    if not email or not sak_id:
        return jsonify({"error": "Mangler 'email' eller 'sakId'"}), 400

    # Finn prosjekt-ID fra saken
    sak_data = sys.db.get_form_data(sak_id)
    if not sak_data:
        return jsonify({"error": "Finner ikke sak"}), 404

    project_id = sak_data.get('sak', {}).get('catenda_project_id')
    if not project_id:
        return jsonify({"error": "Finner ikke prosjekt-ID for saken"}), 404

    # Kall den nye metoden for å finne brukeren
    user_details = sys.catenda.find_user_in_project(project_id, email)

    if user_details and user_details.get('name'):
        return jsonify({
            "success": True,
            "name": user_details['name'],
            "email": user_details.get('username', email),
            "company": user_details.get('company', '')
        }), 200
    else:
        return jsonify({
            "success": False,
            "error": "Brukeren er ikke medlem i dette Catenda-prosjektet."
        }), 404

@app.route('/api/cases/<string:sakId>', methods=['GET'])
def get_case(sakId):
    sys = get_system()
    data = sys.db.get_form_data(sakId)
    if data:
        # Extract topicGuid from the nested 'sak' object for the response
        topic_guid = data.get('sak', {}).get('catenda_topic_id')
        
        # Return in format expected by React frontend
        return jsonify({
            "sakId": sakId,
            "topicGuid": topic_guid,
            "formData": data,
            "status": data.get('sak', {}).get('status', 'Ukjent'),
        }), 200
    return jsonify({"error": "Sak ikke funnet"}), 404

@app.route('/api/varsel-submit', methods=['POST'])
@limiter.limit("10 per minute")  # Rate limit: Max 10 submissions per minutt
@require_csrf  # CSRF beskyttelse
def submit_varsel():
    logger.info("📥 Mottok varsel-submit request")
    sys = get_system()
    payload = request.get_json()
    sak_id = payload.get('sakId')
    form_data = payload.get('formData')
    topic_guid = payload.get('topicGuid')

    logger.info(f"  sakId: {sak_id}, topicGuid: {topic_guid}")

    if not sak_id or not form_data:
        logger.warning(f"  Mangler data - sakId: {sak_id}, formData: {bool(form_data)}")
        return jsonify({"error": "Mangler data"}), 400

    # Auto-populate varsel date if not already set (i.e., not "tidligere varslet")
    varsel = form_data.get('varsel', {})
    if not varsel.get('dato_varsel_sendt'):
        varsel['dato_varsel_sendt'] = datetime.now().strftime('%Y-%m-%d')

    # Lagre data (save_form_data synkroniserer automatisk status/modus til CSV)
    sys.db.save_form_data(sak_id, form_data)

    # Sikre at første krav-revisjon eksisterer
    if not form_data.get('koe_revisjoner') or len(form_data.get('koe_revisjoner', [])) == 0:
        form_data['koe_revisjoner'] = [{
            'koe_revisjonsnr': '0',
            'dato_krav_sendt': '',
            'for_entreprenor': '',
            'status': KOE_STATUS['UTKAST'],
            'vederlag': {
                'krav_vederlag': False,
                'krav_produktivitetstap': False,
                'saerskilt_varsel_rigg_drift': False,
                'krav_vederlag_metode': '',
                'krav_vederlag_belop': '',
                'krav_vederlag_begrunnelse': '',
            },
            'frist': {
                'krav_fristforlengelse': False,
                'krav_frist_type': '',
                'krav_frist_antall_dager': '',
                'forsinkelse_kritisk_linje': False,
                'krav_frist_begrunnelse': '',
            },
        }]
        sys.db.save_form_data(sak_id, form_data)
        logger.info(f"✅ Opprettet første krav-revisjon for sak {sak_id}")

    sys.db.log_historikk(sak_id, 'varsel_sendt', 'Varsel sendt fra entreprenør')

    # Post kommentar
    base_url = sys.get_react_app_base_url()
    magic_token = magic_link_mgr.generate(sak_id=sak_id)
    form_link = f"{base_url}?magicToken={magic_token}"

    comment_text = (
        f"**Varsel for krav om endringsordre (KOE) er sendt**\n\n"
        f"🔢 Sak-ID: `{sak_id}`\n\n"
        f"**Neste steg:** Entreprenør skal nå fylle ut krav\n"
        f"👉 [Åpne skjema]({form_link})\n\n"
        f"📎 PDF-vedlegg tilgjengelig under dokumenter"
    )
    sys.catenda.create_comment(topic_guid, comment_text)

    return jsonify({"success": True, "nextMode": "koe"}), 200

@app.route('/api/koe-submit', methods=['POST'])
@limiter.limit("10 per minute")
@require_csrf
def submit_koe():
    logger.info("📥 Mottok koe-submit request")
    sys = get_system()
    payload = request.get_json()
    sak_id = payload.get('sakId')
    form_data = payload.get('formData')
    topic_guid = payload.get('topicGuid')

    logger.info(f"  sakId: {sak_id}, topicGuid: {topic_guid}")

    # Auto-populate krav submission date and signature
    koe_revisjoner = form_data.get('koe_revisjoner', [])
    if koe_revisjoner:
        siste_koe = koe_revisjoner[-1]
        siste_koe['dato_krav_sendt'] = datetime.now().strftime('%Y-%m-%d')
        # In production: get from Entra ID token. For now, use sak creator or default
        siste_koe['for_entreprenor'] = form_data.get('sak', {}).get('opprettet_av', 'Demo User')

    sys.db.save_form_data(sak_id, form_data)

    # Sikre at første BH svar-revisjon eksisterer
    if not form_data.get('bh_svar_revisjoner') or len(form_data.get('bh_svar_revisjoner', [])) == 0:
        form_data['bh_svar_revisjoner'] = [{
            'vederlag': {
                'varsel_for_sent': False,
                'varsel_for_sent_begrunnelse': '',
                'bh_svar_vederlag': '',
                'bh_vederlag_metode': '',
                'bh_godkjent_vederlag_belop': '',
                'bh_begrunnelse_vederlag': '',
            },
            'frist': {
                'varsel_for_sent': False,
                'varsel_for_sent_begrunnelse': '',
                'bh_svar_frist': '',
                'bh_godkjent_frist_dager': '',
                'bh_frist_for_spesifisering': '',
                'bh_begrunnelse_frist': '',
            },
            'mote_dato': '',
            'mote_referat': '',
            'sign': {
                'dato_svar_bh': '',
                'for_byggherre': '',
            },
            'status': BH_SVAR_STATUS['UTKAST'],
        }]
        sys.db.save_form_data(sak_id, form_data)
        logger.info(f"✅ Opprettet første BH svar-revisjon for sak {sak_id}")

    # Status og modus synkroniseres automatisk fra formData via save_form_data
    sys.db.log_historikk(sak_id, 'koe_sendt', 'KOE sendt fra entreprenør')

    # Hent krav-detaljer
    siste_koe = koe_revisjoner[-1] if koe_revisjoner else {}
    revisjonsnr = siste_koe.get('koe_revisjonsnr', '0')

    vederlag_info = siste_koe.get('vederlag', {})
    har_vederlag = vederlag_info.get('krav_vederlag', False)
    krevd_beløp = vederlag_info.get('krevd_belop', '')

    frist_info = siste_koe.get('frist', {})
    har_frist = frist_info.get('krav_fristforlengelse', False)
    antall_dager = frist_info.get('antall_dager', '')

    comment_text = (
        f"📋 **Krav om endringsordre (KOE) sendt**\n\n"
        f"🔢 Revisjon: {revisjonsnr}\n"
    )

    if har_vederlag and krevd_beløp:
        comment_text += f"💰 Vederlag: {krevd_beløp} NOK\n"
    if har_frist and antall_dager:
        comment_text += f"📆 Fristforlengelse: {antall_dager} dager\n"

    base_url = sys.get_react_app_base_url()
    magic_token = magic_link_mgr.generate(sak_id=sak_id)
    form_link = f"{base_url}?magicToken={magic_token}"

    comment_text += (
        f"\n**Neste steg:** Byggherre svarer på krav\n"
        f"👉 [Åpne skjema]({form_link})\n\n"
        f"📎 PDF-vedlegg tilgjengelig under dokumenter"
    )

    sys.catenda.create_comment(topic_guid, comment_text)

    return jsonify({"success": True, "nextMode": "svar"}), 200

@app.route('/api/svar-submit', methods=['POST'])
@limiter.limit("10 per minute")
@require_csrf
def submit_svar():
    logger.info("📥 Mottok svar-submit request")
    sys = get_system()
    payload = request.get_json()
    sak_id = payload.get('sakId')
    form_data = payload.get('formData')
    topic_guid = payload.get('topicGuid')

    logger.info(f"  sakId: {sak_id}, topicGuid: {topic_guid}")

    # Auto-populate BH svar submission date and signature
    bh_svar_revisjoner = form_data.get('bh_svar_revisjoner', [])
    if bh_svar_revisjoner:
        siste_svar = bh_svar_revisjoner[-1]
        if 'sign' not in siste_svar:
            siste_svar['sign'] = {}
        siste_svar['sign']['dato_svar_bh'] = datetime.now().strftime('%Y-%m-%d')
        # In production: get from Entra ID token. For now, use sak byggherre or default
        siste_svar['sign']['for_byggherre'] = form_data.get('sak', {}).get('byggherre', 'Demo Byggherre')

    # Hent BH svar-detaljer først for å bestemme neste steg
    bh_svar_revisjoner = form_data.get('bh_svar_revisjoner', [])
    siste_svar = bh_svar_revisjoner[-1] if bh_svar_revisjoner else {}

    vederlag_svar = siste_svar.get('vederlag', {})
    bh_svar_vederlag = vederlag_svar.get('bh_svar_vederlag', '')
    godkjent_beløp = vederlag_svar.get('bh_godkjent_belop', '')

    frist_svar = siste_svar.get('frist', {})
    bh_svar_frist = frist_svar.get('bh_svar_frist', '')
    godkjente_dager = frist_svar.get('bh_godkjente_dager', '')

    # Sjekk om det trengs revidering
    trenger_revisjon = krever_revisjon(bh_svar_vederlag, bh_svar_frist)

    # Lagre data først
    sys.db.save_form_data(sak_id, form_data)

    # Hvis det trengs revidering, opprett ny krav-revisjon automatisk
    if trenger_revisjon:
        koe_revisjoner = form_data.get('koe_revisjoner', [])
        if koe_revisjoner:
            siste_krav = koe_revisjoner[-1]
            nytt_revisjonsnr = str(int(siste_krav.get('koe_revisjonsnr', '0')) + 1)

            ny_krav_revisjon = {
                'koe_revisjonsnr': nytt_revisjonsnr,
                'dato_krav_sendt': '',
                'for_entreprenor': '',
                'status': KOE_STATUS['UTKAST'],
                'vederlag': {
                    'krav_vederlag': False,
                    'krav_produktivitetstap': False,
                    'saerskilt_varsel_rigg_drift': False,
                    'krav_vederlag_metode': '',
                    'krav_vederlag_belop': '',
                    'krav_vederlag_begrunnelse': '',
                },
                'frist': {
                    'krav_fristforlengelse': False,
                    'krav_frist_type': '',
                    'krav_frist_antall_dager': '',
                    'forsinkelse_kritisk_linje': False,
                    'krav_frist_begrunnelse': '',
                },
            }
            form_data['koe_revisjoner'].append(ny_krav_revisjon)

            # Opprett også ny BH svar-revisjon for neste runde
            ny_bh_svar_revisjon = {
                'vederlag': {
                    'varsel_for_sent': False,
                    'varsel_for_sent_begrunnelse': '',
                    'bh_svar_vederlag': '',
                    'bh_vederlag_metode': '',
                    'bh_godkjent_vederlag_belop': '',
                    'bh_begrunnelse_vederlag': '',
                },
                'frist': {
                    'varsel_for_sent': False,
                    'varsel_for_sent_begrunnelse': '',
                    'bh_svar_frist': '',
                    'bh_godkjent_frist_dager': '',
                    'bh_frist_for_spesifisering': '',
                    'bh_begrunnelse_frist': '',
                },
                'mote_dato': '',
                'mote_referat': '',
                'sign': {
                    'dato_svar_bh': '',
                    'for_byggherre': '',
                },
                'status': BH_SVAR_STATUS['UTKAST'],
            }
            form_data['bh_svar_revisjoner'].append(ny_bh_svar_revisjon)

            sys.db.save_form_data(sak_id, form_data)
            logger.info(f"✅ Opprettet ny krav-revisjon {nytt_revisjonsnr} og BH svar-revisjon for sak {sak_id}")

    # Status og modus synkroniseres automatisk fra formData via save_form_data
    sys.db.log_historikk(sak_id, 'bh_svar', 'Byggherre har svart')

    comment_text = "✍️ **Svar fra byggherre**\n\n**Beslutning:**\n"

    if vederlag_svar.get('bh_svar_vederlag'):
        svar_tekst = get_vederlag_svar_label(bh_svar_vederlag)
        if godkjent_beløp:
            comment_text += f"💰 Vederlag: {svar_tekst} ({godkjent_beløp} NOK)\n"
        else:
            comment_text += f"💰 Vederlag: {svar_tekst}\n"

    if frist_svar.get('bh_svar_frist'):
        svar_tekst = get_frist_svar_label(bh_svar_frist)
        if godkjente_dager:
            comment_text += f"📆 Frist: {svar_tekst} ({godkjente_dager} dager)\n"
        else:
            comment_text += f"📆 Frist: {svar_tekst}\n"

    if trenger_revisjon:
        comment_text += f"\n**Neste steg:** Entreprenør sender revidert krav\n"
    else:
        comment_text += f"\n**Status:** Sak kan lukkes\n"

    base_url = sys.get_react_app_base_url()
    magic_token = magic_link_mgr.generate(sak_id=sak_id)
    form_link = f"{base_url}?magicToken={magic_token}"

    comment_text += f"👉 [Åpne skjema]({form_link})"

    sys.catenda.create_comment(topic_guid, comment_text)

    return jsonify({"success": True}), 200

@app.route('/api/cases/<string:sakId>/revidering', methods=['POST'])
def submit_revidering(sakId):
    """Handle submission of revised KOE from entrepreneur"""
    logger.info(f"📥 Mottok revidering-submit request for sak {sakId}")
    sys = get_system()
    payload = request.get_json()
    form_data = payload.get('formData')
    topic_guid = form_data.get('sak', {}).get('catenda_topic_id')

    logger.info(f"  topicGuid: {topic_guid}")

    # Auto-populate krav submission date and signature
    koe_revisjoner = form_data.get('koe_revisjoner', [])
    if koe_revisjoner:
        siste_koe = koe_revisjoner[-1]
        siste_koe['dato_krav_sendt'] = datetime.now().strftime('%Y-%m-%d')
        siste_koe['for_entreprenor'] = form_data.get('sak', {}).get('opprettet_av', 'Demo User')

    sys.db.save_form_data(sakId, form_data)
    sys.db.log_historikk(sakId, 'revisjon_sendt', 'Revidert krav sendt fra entreprenør')

    # Hent krav-detaljer
    siste_koe = koe_revisjoner[-1] if koe_revisjoner else {}
    revisjonsnr = siste_koe.get('koe_revisjonsnr', '0')

    vederlag_info = siste_koe.get('vederlag', {})
    har_vederlag = vederlag_info.get('krav_vederlag', False)
    krevd_beløp = vederlag_info.get('krevd_belop', '')

    frist_info = siste_koe.get('frist', {})
    har_frist = frist_info.get('krav_fristforlengelse', False)
    antall_dager = frist_info.get('antall_dager', '')

    comment_text = (
        f"🔄 **Revidert krav om endringsordre (KOE) sendt**\n\n"
        f"🔢 Revisjon: {revisjonsnr}\n"
    )

    if har_vederlag and krevd_beløp:
        comment_text += f"💰 Vederlag: {krevd_beløp} NOK\n"
    if har_frist and antall_dager:
        comment_text += f"📆 Fristforlengelse: {antall_dager} dager\n"

    base_url = sys.get_react_app_base_url()
    magic_token = magic_link_mgr.generate(sak_id=sakId)
    form_link = f"{base_url}?magicToken={magic_token}"

    comment_text += (
        f"\n**Neste steg:** Byggherre svarer på revidert krav\n"
        f"👉 [Åpne skjema]({form_link})\n\n"
        f"📎 PDF-vedlegg tilgjengelig under dokumenter"
    )

    sys.catenda.create_comment(topic_guid, comment_text)

    return jsonify({"success": True, "nextMode": "svar"}), 200

@app.route('/api/cases/<string:sakId>/draft', methods=['PUT'])
def save_draft(sakId):
    sys = get_system()
    payload = request.get_json()
    form_data = payload.get('formData')
    
    sys.db.save_form_data(sakId, form_data)
    return jsonify({"success": True, "message": "Utkast lagret"}), 200

@app.route('/api/cases/<string:sakId>/pdf', methods=['POST'])
def upload_pdf(sakId):
    """Fase 4: Endepunkt for PDF-opplasting"""
    logger.info(f"📥 Mottok PDF-opplasting for sak {sakId}")
    sys = get_system()
    payload = request.get_json()

    pdf_base64 = payload.get('pdfBase64')
    filename = payload.get('filename')
    topic_guid = payload.get('topicGuid')

    logger.info(f"  filename: {filename}, topicGuid: {topic_guid}")

    if not pdf_base64 or not filename or not topic_guid:
        logger.warning(f"  Mangler data - pdf: {bool(pdf_base64)}, filename: {filename}, topicGuid: {topic_guid}")
        return jsonify({"error": "Mangler PDF data eller topic GUID"}), 400

    result = sys.handle_pdf_upload(sakId, pdf_base64, filename, topic_guid)
    
    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 500

# --- Webhook Endpoint ---
WEBHOOK_SECRET_PATH = os.getenv("WEBHOOK_SECRET_PATH")
if not WEBHOOK_SECRET_PATH:
    logger.warning("⚠️  WEBHOOK_SECRET_PATH er ikke satt i .env. Webhook-endepunktet er deaktivert.")

@app.route(f'/webhook/catenda/{WEBHOOK_SECRET_PATH}', methods=['POST'])
@limiter.limit("100 per minute")  # Høyere limit for webhooks
def webhook():
    """
    Webhook endpoint for Catenda events.

    Security:
    - Secret path in URL (security through obscurity)
    - Idempotency Check (forhindrer duplikat-prosessering)
    - Event Structure Validation
    """
    sys = get_system()

    # Den gamle token-valideringen er fjernet, da stien nå er hemmelig.
    # payload = request.get_json()
    # ... (resten av funksjonen) ...

    # 2. Parse payload
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "Invalid JSON"}), 400

    # 3. Valider event structure
    valid_structure, structure_error = validate_webhook_event_structure(payload)
    if not valid_structure:
        logger.warning(f"Invalid webhook structure: {structure_error}")
        return jsonify({"error": "Invalid event structure", "detail": structure_error}), 400

    # 4. Idempotency check (forhindre duplikat-prosessering)
    event_id = get_webhook_event_id(payload)
    if is_duplicate_event(event_id):
        logger.info(f"Duplicate webhook event ignored: {event_id}")
        return jsonify({"status": "already_processed"}), 202

    # 5. Hent event type
    event_obj = payload.get('event', {})
    event_type = event_obj.get('type')

    # 6. Log webhook mottatt
    audit.log_webhook_received(event_type=event_type, event_id=event_id)
    logger.info(f"✅ Processing webhook event: {event_type} (ID: {event_id})")

    # 7. Prosesser event basert på type
    if event_type in ['issue.created', 'bcf.issue.created']:
        result = sys.handle_new_topic_created(payload)
        return jsonify(result), 200

    elif event_type in ['issue.modified', 'bcf.comment.created']:
        result = sys.handle_topic_modification(payload)
        return jsonify(result), 200

    elif event_type == 'issue.status.changed':
        result = sys.handle_topic_modification(payload)
        return jsonify(result), 200

    # Unknown event type (log men aksepter)
    logger.info(f"Unknown webhook event type: {event_type}")
    return jsonify({"status": "ignored", "event_type": event_type}), 200

if __name__ == "__main__":
    if not os.path.exists('config.json'):
        print("❌ config.json mangler. Opprett denne først.")
        sys.exit(1)

    print("🚀 KOE Backend API starter på port 8080...")
    app.run(host='0.0.0.0', port=8080, debug=True)
