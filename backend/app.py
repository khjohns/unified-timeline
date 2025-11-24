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
from threading import Lock

# Flask og CORS
try:
    from flask import Flask, request, jsonify
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
    
    def __init__(self, data_dir: str = "koe_data"):
        self.data_dir = Path(data_dir)
        self.form_data_dir = self.data_dir / "form_data"
        
        self.data_dir.mkdir(exist_ok=True)
        self.form_data_dir.mkdir(exist_ok=True)
        
        # CSV-filer
        self.saker_file = self.data_dir / "saker.csv"
        self.historikk_file = self.data_dir / "historikk.csv"
        
        self.lock = Lock()
        self._initialize_files()
    
    def _initialize_files(self):
        """Opprett CSV-filer med headers hvis de ikke finnes"""
        if not self.saker_file.exists():
            with open(self.saker_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    'sak_id', 'catenda_topic_id', 'catenda_project_id', 'catenda_board_id',
                    'sakstittel', 'opprettet_dato', 'opprettet_av', 'status', 'te_navn', 'modus'
                ])
                writer.writeheader()
        
        if not self.historikk_file.exists():
            with open(self.historikk_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    'timestamp', 'sak_id', 'hendelse_type', 'beskrivelse'
                ])
                writer.writeheader()

    def create_sak(self, sak_data: Dict[str, Any]) -> str:
        """Opprett ny sak i CSV og en tom JSON-fil"""
        with self.lock:
            if 'sak_id' not in sak_data:
                sak_data['sak_id'] = f"KOE-{datetime.now().strftime('%Y%m%d-%H%M')}"

            sak_data.setdefault('opprettet_dato', datetime.now().isoformat())
            sak_data.setdefault('opprettet_av', sak_data.get('te_navn', 'System'))
            sak_data.setdefault('status', 'Ny')
            sak_data.setdefault('modus', 'varsel')
            
            # Lagre til CSV
            with open(self.saker_file, 'a', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    'sak_id', 'catenda_topic_id', 'catenda_project_id', 'catenda_board_id',
                    'sakstittel', 'opprettet_dato', 'opprettet_av', 'status', 'te_navn', 'modus'
                ])
                writer.writerow(sak_data)
            
            # Opprett initiell JSON-fil
            initial_json = {
                "versjon": "5.0",
                "sak": sak_data,
                "varsel": {},
                "koe_revisjoner": [],
                "bh_svar_revisjoner": []
            }
            self.save_form_data(sak_data['sak_id'], initial_json)
            
            self.log_historikk(sak_data['sak_id'], 'sak_opprettet', 'Ny sak opprettet fra Catenda')
            return sak_data['sak_id']

    def save_form_data(self, sak_id: str, data: Dict[str, Any]):
        """Lagre detaljert skjemadata til JSON"""
        file_path = self.form_data_dir / f"{sak_id}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

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
            with open(self.saker_file, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
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
                    writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)

    def log_historikk(self, sak_id: str, hendelse_type: str, beskrivelse: str):
        """Logg til historikk.csv"""
        with open(self.historikk_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['timestamp', 'sak_id', 'hendelse_type', 'beskrivelse'])
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

    def handle_new_topic_created(self, webhook_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fase 2: Håndterer ny topic.
        Oppretter sak og poster lenke til React-app.
        """
        try:
            topic_data = webhook_payload.get('issue', {}) or webhook_payload.get('topic', {})
            topic_id = topic_data.get('id') or topic_data.get('guid')
            title = topic_data.get('title', 'Uten tittel')
            project_id = webhook_payload.get('project_id')
            
            # Hent boardId (viktig for senere API-kall)
            board_id = topic_data.get('boardId') or topic_data.get('topic_board_id')
            
            if not topic_id:
                return {'success': False, 'error': 'Mangler topic ID'}

            # 1. Opprett sak i database
            sak_data = {
                'catenda_topic_id': topic_id,
                'catenda_project_id': project_id,
                'catenda_board_id': board_id, # Lagrer board ID
                'sakstittel': title,
                'te_navn': topic_data.get('creation_author', 'Ukjent')
            }
            sak_id = self.db.create_sak(sak_data)
            
            # 2. Generer Magic Link for tilgang til React App
            magic_token = magic_link_mgr.generate(sak_id=sak_id, email=topic_data.get('creation_author'))

            # Prioriterer miljøvariabel, deretter config, og faller tilbake til dynamisk IP
            dev_url = os.environ.get('DEV_REACT_APP_URL')
            if dev_url:
                base_url = dev_url
            elif 'react_app_url' in self.config:
                base_url = self.config['react_app_url']
            else:
                # Finn dynamisk lokal IP for enkel testing på samme nettverk
                local_ip = get_local_ip()
                base_url = f"http://{local_ip}:3000"
            
            magic_link = f"{base_url}?magicToken={magic_token}"

            # 3. Post kommentar til Catenda
            from datetime import datetime
            dato = datetime.now().strftime('%Y-%m-%d')
            prosjekt = sak_data.get('sakstittel', 'Ukjent prosjekt')

            comment_text = (
                f"✅ **Ny KOE-sak opprettet**\n\n"
                f"📋 Intern Sak-ID: `{sak_id}`\n"
                f"📅 Dato: {dato}\n"
                f"🏗️ Prosjekt: {prosjekt}\n\n"
                f"**Neste steg:** Entreprenør sender varsel\n"
                f"👉 [Åpne skjema]({magic_link})"
            )
            
            self.catenda.topic_board_id = board_id # Sett board ID for API-kallet
            self.catenda.create_comment(topic_id, comment_text)
            logger.info(f"✅ Sak {sak_id} opprettet og lenke sendt til Catenda.")
            
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
CORS(app, resources={r"/api/*": {"origins": "*"}}) # Fase 1: CORS

# Global system instance
system: Optional[KOEAutomationSystem] = None

def get_system():
    global system
    if system is None:
        try:
            with open('config.json', 'r') as f:
                config = json.load(f)
            system = KOEAutomationSystem(config)
        except Exception as e:
            logger.error(f"Kunne ikke starte systemet: {e}")
            sys.exit(1)
    return system

from magic_link import MagicLinkManager
magic_link_mgr = MagicLinkManager()

# --- API Endpoints (Fase 3) ---

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

    # Lagre data
    sys.db.save_form_data(sak_id, form_data)
    sys.db.update_sak_status(sak_id, 'Varslet', 'koe') # Neste modus: koe
    sys.db.log_historikk(sak_id, 'varsel_sendt', 'Varsel sendt fra entreprenør')

    # Post kommentar
    varsel = form_data.get('varsel', {})
    hovedkategori = varsel.get('hovedkategori', 'Ikke spesifisert')
    dato_oppdaget = varsel.get('dato_forhold_oppdaget', 'Ukjent dato')

    comment_text = (
        f"📨 **Varsel om endring sendt**\n\n"
        f"📑 Kategori: {hovedkategori}\n"
        f"📅 Dato oppdaget: {dato_oppdaget}\n\n"
        f"**Neste steg:** Entreprenør spesifiserer krav\n"
        f"👉 [Åpne skjema]({sys.config.get('react_app_url', 'http://localhost:5173')}?sakId={sak_id})"
    )
    sys.catenda.create_comment(topic_guid, comment_text)

    return jsonify({"success": True, "nextMode": "koe"}), 200

@app.route('/api/koe-submit', methods=['POST'])
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
    sys.db.update_sak_status(sak_id, 'Krav sendt', 'svar') # Neste modus: svar
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

    comment_text += (
        f"\n**Neste steg:** Byggherre svarer på krav\n"
        f"👉 [Åpne skjema]({sys.config.get('react_app_url', 'http://localhost:5173')}?sakId={sak_id})\n\n"
        f"📎 PDF-vedlegg tilgjengelig under dokumenter"
    )

    sys.catenda.create_comment(topic_guid, comment_text)

    return jsonify({"success": True, "nextMode": "svar"}), 200

@app.route('/api/svar-submit', methods=['POST'])
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

    status_text = "Behandlet"

    sys.db.save_form_data(sak_id, form_data)
    sys.db.update_sak_status(sak_id, status_text, 'ferdig')
    sys.db.log_historikk(sak_id, 'bh_svar', 'Byggherre har svart')

    # Hent BH svar-detaljer (refresh reference after modification)
    bh_svar_revisjoner = form_data.get('bh_svar_revisjoner', [])
    siste_svar = bh_svar_revisjoner[-1] if bh_svar_revisjoner else {}

    vederlag_svar = siste_svar.get('vederlag', {})
    bh_svar_vederlag = vederlag_svar.get('bh_svar_vederlag', '')
    godkjent_beløp = vederlag_svar.get('bh_godkjent_belop', '')

    frist_svar = siste_svar.get('frist', {})
    bh_svar_frist = frist_svar.get('bh_svar_frist', '')
    godkjente_dager = frist_svar.get('bh_godkjente_dager', '')

    # Map status-verdier til tekst
    vederlag_status_map = {
        '100000000': 'Godkjent fullt ut',
        '100000001': 'Delvis godkjent',
        '100000002': 'Avslått (uenig)',
        '100000003': 'Avslått (for sent)',
        '100000004': 'Avventer',
        '100000005': 'Godkjent med annen metode'
    }

    frist_status_map = {
        '100000000': 'Godkjent fullt ut',
        '100000001': 'Delvis godkjent',
        '100000002': 'Avslått',
        '100000003': 'Avventer'
    }

    comment_text = "✍️ **Svar fra byggherre**\n\n**Beslutning:**\n"

    if vederlag_svar.get('bh_svar_vederlag'):
        svar_tekst = vederlag_status_map.get(bh_svar_vederlag, 'Uspesifisert')
        if godkjent_beløp:
            comment_text += f"💰 Vederlag: {svar_tekst} ({godkjent_beløp} NOK)\n"
        else:
            comment_text += f"💰 Vederlag: {svar_tekst}\n"

    if frist_svar.get('bh_svar_frist'):
        svar_tekst = frist_status_map.get(bh_svar_frist, 'Uspesifisert')
        if godkjente_dager:
            comment_text += f"📆 Frist: {svar_tekst} ({godkjente_dager} dager)\n"
        else:
            comment_text += f"📆 Frist: {svar_tekst}\n"

    # Sjekk om det trengs revidering
    trenger_revisjon = (
        bh_svar_vederlag in ['100000001', '100000002'] or  # Delvis/avslått
        bh_svar_frist in ['100000001', '100000002']
    )

    if trenger_revisjon:
        comment_text += f"\n**Neste steg:** Entreprenør sender revidert krav\n"
    else:
        comment_text += f"\n**Status:** Sak kan lukkes\n"

    comment_text += f"👉 [Åpne skjema]({sys.config.get('react_app_url', 'http://localhost:5173')}?sakId={sak_id})"

    sys.catenda.create_comment(topic_guid, comment_text)

    return jsonify({"success": True}), 200

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
@app.route('/webhook/catenda', methods=['POST'])
def webhook():
    sys = get_system()
    payload = request.get_json()
    event_type = payload.get('event', {}).get('type') or payload.get('event')

    logger.info(f"Webhook mottatt: {event_type}")

    if event_type in ['issue.created', 'bcf.issue.created']:
        result = sys.handle_new_topic_created(payload)
        return jsonify(result), 200
    
    elif event_type in ['issue.modified', 'bcf.comment.created']:
        result = sys.handle_topic_modification(payload)
        return jsonify(result), 200
    
    return jsonify({"status": "ignored"}), 200

if __name__ == "__main__":
    if not os.path.exists('config.json'):
        print("❌ config.json mangler. Opprett denne først.")
        sys.exit(1)

    print("🚀 KOE Backend API starter på port 8080...")
    app.run(host='0.0.0.0', port=8080, debug=True)
