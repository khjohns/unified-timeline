"""
Catenda API Client
==================

Production-ready Catenda API client for KOE/EO workflow.
med særlig fokus på å verifisere ID-mapping mellom library-item-id og document_guid.

Basert på: Catenda_API_Vurdering_KOE_EO_Flyt_v2.md

Kritisk usikkerhet som skal verifiseres:
- Kan library-item-id fra v2 API brukes direkte som document_guid i BCF API?
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, List, Tuple
import logging
from pathlib import Path

# Konfigurer logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('catenda_api_test.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class CatendaClient:
    """
    Tester for Catenda API (REST v2 og BCF v3.0)
    """
    
    def __init__(self, client_id: str, client_secret: Optional[str] = None, access_token: Optional[str] = None):
        """
        Initialiser API tester med OAuth credentials.
        
        Args:
            client_id: OAuth Client ID fra Catenda
            client_secret: OAuth Client Secret (kun for Boost-kunder)
            access_token: Ferdig access token (hvis du allerede har hentet det manuelt)
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = "https://api.catenda.com"
        self.access_token: Optional[str] = access_token
        self.token_expiry: Optional[datetime] = None
        self.refresh_token: Optional[str] = None
        
        # Disse fylles inn under testing
        self.project_id: Optional[str] = None
        self.topic_board_id: Optional[str] = None
        self.library_id: Optional[str] = None
        self.test_topic_id: Optional[str] = None
        
        logger.info("✅ CatendaClient initialisert")
    
    # ==========================================
    # AUTHENTICATION
    # ==========================================
    
    def authenticate(self) -> bool:
        """
        Hent OAuth access token via Client Credentials Grant.
        
        OBS: Denne metoden fungerer kun for Catenda Boost-kunder!
        
        For andre brukere, bruk get_authorization_url() og set_access_token()
        for Authorization Code Grant flow.
        
        Returns:
            True hvis autentisering lyktes, False ellers
        """
        if not self.client_secret:
            logger.error("❌ Client Secret mangler - kan ikke autentisere med Client Credentials Grant")
            logger.info("ℹ️  Bruk get_authorization_url() for Authorization Code Grant i stedet")
            return False
        
        logger.info("🔐 Starter autentisering (Client Credentials Grant)...")
        logger.info("⚠️  Merk: Dette fungerer kun for Catenda Boost-kunder")
        
        url = f"{self.base_url}/oauth2/token"
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        try:
            response = requests.post(url, headers=headers, data=data)
            response.raise_for_status()
            
            token_data = response.json()
            self.access_token = token_data["access_token"]
            
            # Beregn utløpstidspunkt (legg til litt margin)
            expires_in = token_data.get("expires_in", 3600)
            self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
            
            logger.info(f"✅ Autentisering vellykket. Token utløper: {self.token_expiry}")
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Autentisering feilet: {e}")
            
            if hasattr(e, 'response') and e.response is not None:
                error_text = e.response.text
                logger.error(f"Response: {error_text}")
                
                # Spesifikk håndtering av unauthorized_client
                if "unauthorized_client" in error_text:
                    logger.error("")
                    logger.error("=" * 80)
                    logger.error("DIAGNOSE: Client Credentials Grant er ikke tilgjengelig")
                    logger.error("=" * 80)
                    logger.error("")
                    logger.error("Client Credentials Grant fungerer kun for Catenda Boost-kunder.")
                    logger.error("")
                    logger.error("Du må bruke Authorization Code Grant i stedet:")
                    logger.error("1. Kjør: tester.get_authorization_url(redirect_uri)")
                    logger.error("2. Åpne URL-en i nettleser og godkjenn")
                    logger.error("3. Kopier 'code' fra redirect URL")
                    logger.error("4. Kjør: tester.exchange_code_for_token(code, redirect_uri)")
                    logger.error("")
                    logger.error("Se README.md for detaljert veiledning.")
                    logger.error("=" * 80)
            
            return False
    
    # ==========================================
    # AUTHORIZATION CODE GRANT (For ikke-Boost kunder)
    # ==========================================
    
    def get_authorization_url(self, redirect_uri: str, state: str = None) -> str:
        """
        Generer authorization URL for Authorization Code Grant flow.
        
        Bruk denne metoden hvis Client Credentials Grant ikke fungerer.
        
        Args:
            redirect_uri: Din registrerte redirect URI
            state: Valgfri state parameter for sikkerhet
        
        Returns:
            URL som brukeren må åpne i nettleser
        """
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri
        }
        
        if state:
            params["state"] = state
        
        # Bygg URL
        from urllib.parse import urlencode
        query_string = urlencode(params)
        auth_url = f"{self.base_url}/oauth2/authorize?{query_string}"
        
        logger.info("🔗 Authorization URL generert:")
        logger.info(f"   {auth_url}")
        logger.info("")
        logger.info("📋 Steg:")
        logger.info("   1. Åpne denne URL-en i nettleser")
        logger.info("   2. Logg inn og godkjenn tilgang")
        logger.info("   3. Kopier 'code' fra redirect URL-en")
        logger.info("   4. Kjør: exchange_code_for_token(code, redirect_uri)")
        
        return auth_url
    
    def exchange_code_for_token(self, code: str, redirect_uri: str) -> bool:
        """
        Bytt authorization code mot access token.
        
        Args:
            code: Authorization code fra redirect
            redirect_uri: Samme redirect URI som ble brukt i get_authorization_url()
        
        Returns:
            True hvis vellykket
        """
        logger.info("🔄 Bytter authorization code mot access token...")
        
        url = f"{self.base_url}/oauth2/token"
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": redirect_uri
        }
        
        try:
            response = requests.post(url, headers=headers, data=data)
            response.raise_for_status()
            
            token_data = response.json()
            self.access_token = token_data["access_token"]
            
            # Lagre refresh token hvis tilgjengelig
            if "refresh_token" in token_data:
                self.refresh_token = token_data["refresh_token"]
                logger.info("✅ Refresh token mottatt og lagret")
            
            # Beregn utløpstidspunkt
            expires_in = token_data.get("expires_in", 3600)
            self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
            
            logger.info(f"✅ Access token hentet! Utløper: {self.token_expiry}")
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved token exchange: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return False
    
    def set_access_token(self, token: str, expires_in: int = 3600):
        """
        Sett access token manuelt (hvis du har hentet det på annen måte).
        
        Args:
            token: Access token
            expires_in: Sekunder til token utløper (default: 3600)
        """
        self.access_token = token
        self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
        logger.info("✅ Access token satt manuelt")
        logger.info(f"   Utløper: {self.token_expiry}")
    
    # ==========================================
    # TOKEN MANAGEMENT
    # ==========================================
    
    def ensure_authenticated(self) -> bool:
        """
        Sjekk om token er gyldig, fornye om nødvendig.
        
        Returns:
            True hvis autentisert, False ellers
        """
        if not self.access_token or not self.token_expiry:
            logger.warning("⚠️ Ingen access token - kan ikke autentisere automatisk")
            logger.warning("    Bruk get_authorization_url() eller authenticate()")
            return False
        
        if datetime.now() >= self.token_expiry:
            logger.info("🔄 Token utløpt, må fornyes manuelt")
            logger.warning("    For Authorization Code Grant: hent nytt token via nettleser")
            logger.warning("    For Client Credentials: kjør authenticate() på nytt")
            return False
        
        return True
    
    def get_headers(self) -> Dict[str, str]:
        """
        Returner standard headers for API-kall.
        """
        if not self.ensure_authenticated():
            raise RuntimeError("Kunne ikke autentisere")
        
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
    
    # ==========================================
    # PROJECT & TOPIC BOARD DISCOVERY
    # ==========================================
    
    def list_topic_boards(self) -> List[Dict]:
        """
        List alle tilgjengelige topic boards (BCF projects).
        
        Returns:
            Liste med topic boards
        """
        logger.info("📋 Henter topic boards...")
        
        url = f"{self.base_url}/opencde/bcf/3.0/projects"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            boards = response.json()
            logger.info(f"✅ Fant {len(boards)} topic board(s)")
            
            for board in boards:
                logger.info(f"  - {board['name']} (ID: {board['project_id']})")
            
            return boards
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av topic boards: {e}")
            return []
    
    def select_topic_board(self, board_index: int = 0) -> bool:
        """
        Velg en topic board for testing.
        
        Args:
            board_index: Index av board å bruke (default: 0)
        
        Returns:
            True hvis vellykket
        """
        boards = self.list_topic_boards()
        
        if not boards:
            logger.error("❌ Ingen topic boards funnet")
            return False
        
        if board_index >= len(boards):
            logger.error(f"❌ Ugyldig board index: {board_index}")
            return False
        
        selected = boards[board_index]
        self.topic_board_id = selected['project_id']
        
        logger.info(f"✅ Valgte topic board: {selected['name']}")
        return True

    def get_topic_board(self, board_id: Optional[str] = None) -> Optional[Dict]:
        """
        Hent detaljer for et topic board.

        Args:
            board_id: Topic board ID (bruker self.topic_board_id hvis ikke angitt)

        Returns:
            Board-data eller None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return None

        logger.info(f"📋 Henter topic board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}"

        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()

            board = response.json()
            logger.info(f"✅ Hentet board: {board.get('name')}")
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av topic board: {e}")
            return None

    def create_topic_board(self, name: str, project_id: Optional[str] = None) -> Optional[Dict]:
        """
        Opprett nytt topic board.

        Args:
            name: Navn på boardet
            project_id: Catenda project ID (bruker self.project_id hvis ikke angitt)

        Returns:
            Opprettet board eller None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("❌ Ingen project ID angitt")
            return None

        logger.info(f"📋 Oppretter topic board '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects"

        payload = {
            "name": name,
            "bimsync_project_id": project_id
        }

        try:
            response = requests.post(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            board = response.json()
            logger.info(f"✅ Opprettet board: {board.get('name')} (ID: {board.get('project_id')})")
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved opprettelse av topic board: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    def update_topic_board(self, name: str, board_id: Optional[str] = None) -> Optional[Dict]:
        """
        Oppdater navn på topic board.

        Args:
            name: Nytt navn
            board_id: Topic board ID (bruker self.topic_board_id hvis ikke angitt)

        Returns:
            Oppdatert board eller None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return None

        logger.info(f"📋 Oppdaterer topic board '{board_id}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}"

        payload = {"name": name}

        try:
            response = requests.put(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            board = response.json()
            logger.info(f"✅ Oppdatert board: {board.get('name')}")
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppdatering av topic board: {e}")
            return None

    def get_topic_board_extensions(self, board_id: Optional[str] = None) -> Optional[Dict]:
        """
        Hent extensions (statuser, typer, labels, prioriteter, brukere, etc) for et board.

        Args:
            board_id: Topic board ID (bruker self.topic_board_id hvis ikke angitt)

        Returns:
            Extensions-data eller None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return None

        logger.info(f"📋 Henter extensions for board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions"

        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()

            extensions = response.json()
            logger.info(f"✅ Hentet extensions")
            return extensions

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av extensions: {e}")
            return None

    def get_topic_board_with_custom_fields(
        self,
        board_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Hent topic board med custom fields (v2 API).

        Args:
            board_id: Topic board ID (bruker self.topic_board_id hvis ikke angitt)
            project_id: Catenda project ID (bruker self.project_id hvis ikke angitt)

        Returns:
            Board-data med custom fields eller None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return None

        project_id = project_id or self.project_id
        if not project_id:
            logger.error("❌ Ingen project ID angitt")
            return None

        logger.info(f"📋 Henter board med custom fields...")
        url = f"{self.base_url}/v2/projects/{project_id}/issues/boards/{board_id}"
        params = {"include": "customFields,customFieldInstances"}

        try:
            response = requests.get(url, headers=self.get_headers(), params=params)
            response.raise_for_status()

            board = response.json()
            logger.info(f"✅ Hentet board med {len(board.get('customFieldInstances', []))} custom field(s)")
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av board med custom fields: {e}")
            return None

    # ------------------------------------------
    # Custom Field Management
    # ------------------------------------------

    def _update_custom_fields(
        self,
        board_id: str,
        project_id: str,
        payload: Dict
    ) -> Optional[Dict]:
        """
        Intern hjelpemetode for å oppdatere custom fields på et board.

        Args:
            board_id: Topic board ID
            project_id: Catenda project ID
            payload: Request body med custom field-operasjoner

        Returns:
            Oppdatert board eller None
        """
        url = f"{self.base_url}/v2/projects/{project_id}/issues/boards/{board_id}"
        params = {"include": "customFields,customFieldInstances"}

        try:
            response = requests.patch(url, headers=self.get_headers(), json=payload, params=params)
            response.raise_for_status()

            board = response.json()
            return board

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppdatering av custom fields: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    def add_custom_field_to_board(
        self,
        custom_field_id: str,
        board_id: Optional[str] = None,
        project_id: Optional[str] = None,
        required: bool = False,
        default_value: Optional[Any] = None,
        disabled: bool = False
    ) -> Optional[Dict]:
        """
        Legg til et eksisterende custom field på et topic board.

        Args:
            custom_field_id: ID til custom field som skal legges til
            board_id: Topic board ID
            project_id: Catenda project ID
            required: Om feltet er påkrevd
            default_value: Standardverdi for feltet
            disabled: Om feltet skal være deaktivert

        Returns:
            Oppdatert board eller None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("❌ board_id og project_id er påkrevd")
            return None

        logger.info(f"📋 Legger til custom field {custom_field_id} på board...")

        field_config = {
            "id": custom_field_id,
            "required": required,
            "disabled": disabled
        }
        if default_value is not None:
            field_config["defaultValue"] = default_value

        payload = {"customFieldsToAdd": [field_config]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info(f"✅ Custom field lagt til")
        return result

    def modify_custom_field_on_board(
        self,
        custom_field_id: str,
        board_id: Optional[str] = None,
        project_id: Optional[str] = None,
        required: Optional[bool] = None,
        default_value: Optional[Any] = None,
        disabled: Optional[bool] = None
    ) -> Optional[Dict]:
        """
        Endre innstillinger for et custom field på et board.

        Args:
            custom_field_id: ID til custom field
            board_id: Topic board ID
            project_id: Catenda project ID
            required: Om feltet er påkrevd (None = ikke endre)
            default_value: Standardverdi (None = ikke endre)
            disabled: Om feltet skal være deaktivert (None = ikke endre)

        Returns:
            Oppdatert board eller None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("❌ board_id og project_id er påkrevd")
            return None

        logger.info(f"📋 Oppdaterer custom field {custom_field_id}...")

        field_config = {"id": custom_field_id}
        if required is not None:
            field_config["required"] = required
        if default_value is not None:
            field_config["defaultValue"] = default_value
        if disabled is not None:
            field_config["disabled"] = disabled

        payload = {"customFieldsToModify": [field_config]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info(f"✅ Custom field oppdatert")
        return result

    def disable_custom_field_on_board(
        self,
        custom_field_id: str,
        board_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Deaktiver et custom field på et board.

        Args:
            custom_field_id: ID til custom field
            board_id: Topic board ID
            project_id: Catenda project ID

        Returns:
            Oppdatert board eller None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("❌ board_id og project_id er påkrevd")
            return None

        logger.info(f"📋 Deaktiverer custom field {custom_field_id}...")

        payload = {"customFieldsToDisable": [{"id": custom_field_id}]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info(f"✅ Custom field deaktivert")
        return result

    def restore_custom_field_on_board(
        self,
        custom_field_id: str,
        board_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Gjenopprett et deaktivert custom field på et board.

        Args:
            custom_field_id: ID til custom field
            board_id: Topic board ID
            project_id: Catenda project ID

        Returns:
            Oppdatert board eller None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("❌ board_id og project_id er påkrevd")
            return None

        logger.info(f"📋 Gjenoppretter custom field {custom_field_id}...")

        payload = {"customFieldstoRestore": [{"id": custom_field_id}]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info(f"✅ Custom field gjenopprettet")
        return result

    def delete_custom_field_from_board(
        self,
        custom_field_id: str,
        board_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Fjern et custom field fra et board.

        Args:
            custom_field_id: ID til custom field
            board_id: Topic board ID
            project_id: Catenda project ID

        Returns:
            Oppdatert board eller None
        """
        board_id = board_id or self.topic_board_id
        project_id = project_id or self.project_id

        if not board_id or not project_id:
            logger.error("❌ board_id og project_id er påkrevd")
            return None

        logger.info(f"🗑️ Fjerner custom field {custom_field_id} fra board...")

        payload = {"customFieldsToDelete": [{"id": custom_field_id}]}
        result = self._update_custom_fields(board_id, project_id, payload)

        if result:
            logger.info(f"✅ Custom field fjernet")
        return result

    def list_available_custom_fields(
        self,
        board_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> List[Dict]:
        """
        List alle tilgjengelige custom fields (både aktive og ikke-aktive på boardet).

        Args:
            board_id: Topic board ID
            project_id: Catenda project ID

        Returns:
            Liste med custom fields
        """
        board = self.get_topic_board_with_custom_fields(board_id, project_id)
        if not board:
            return []

        return board.get('customFields', [])

    # ------------------------------------------
    # Project-level Custom Fields (v2 API)
    # ------------------------------------------

    def list_project_custom_fields(self, project_id: Optional[str] = None) -> List[Dict]:
        """
        List alle custom fields definert på prosjektnivå.

        Args:
            project_id: Catenda project ID

        Returns:
            Liste med custom fields
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("❌ project_id er påkrevd")
            return []

        logger.info(f"📋 Henter custom fields for prosjekt {project_id}...")
        url = f"{self.base_url}/v2/projects/{project_id}/custom-fields"

        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()

            fields = response.json()
            logger.info(f"✅ Fant {len(fields)} custom field(s)")
            return fields

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av custom fields: {e}")
            return []

    def create_project_custom_field(
        self,
        name: str,
        field_type: str = "text",
        description: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Opprett ny custom field på prosjektnivå.

        Args:
            name: Navn på custom field
            field_type: Type ('text', 'integer', 'double', 'enumeration')
            description: Beskrivelse (valgfri)
            project_id: Catenda project ID

        Returns:
            Opprettet custom field eller None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("❌ project_id er påkrevd")
            return None

        logger.info(f"📋 Oppretter custom field '{name}'...")
        url = f"{self.base_url}/v2/projects/{project_id}/custom-fields"

        payload = {
            "name": name,
            "type": field_type
        }
        if description:
            payload["description"] = description

        try:
            response = requests.post(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            field = response.json()
            logger.info(f"✅ Opprettet custom field: {field.get('name')} (ID: {field.get('id')})")
            return field

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved opprettelse av custom field: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    def get_project_custom_field(
        self,
        custom_field_id: str,
        project_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Hent én custom field fra prosjektnivå.

        Args:
            custom_field_id: ID til custom field
            project_id: Catenda project ID

        Returns:
            Custom field eller None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("❌ project_id er påkrevd")
            return None

        url = f"{self.base_url}/v2/projects/{project_id}/custom-fields/{custom_field_id}"

        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av custom field: {e}")
            return None

    def update_project_custom_field(
        self,
        custom_field_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        archived: Optional[bool] = None,
        project_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Oppdater custom field på prosjektnivå.

        Args:
            custom_field_id: ID til custom field
            name: Nytt navn (valgfri)
            description: Ny beskrivelse (valgfri)
            archived: Arkiver/gjenopprett (valgfri)
            project_id: Catenda project ID

        Returns:
            Oppdatert custom field eller None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("❌ project_id er påkrevd")
            return None

        logger.info(f"📋 Oppdaterer custom field {custom_field_id}...")
        url = f"{self.base_url}/v2/projects/{project_id}/custom-fields/{custom_field_id}"

        payload = {}
        if name is not None:
            payload["name"] = name
        if description is not None:
            payload["description"] = description
        if archived is not None:
            payload["archived"] = archived

        try:
            response = requests.patch(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            field = response.json()
            logger.info(f"✅ Oppdatert custom field: {field.get('name')}")
            return field

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppdatering av custom field: {e}")
            return None

    def add_enumeration_items(
        self,
        custom_field_id: str,
        items: List[Dict],
        project_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Legg til enumeration items på en custom field.

        Args:
            custom_field_id: ID til custom field
            items: Liste med items [{"name": "Item 1"}, {"name": "Item 2"}]
            project_id: Catenda project ID

        Returns:
            Oppdatert custom field eller None
        """
        project_id = project_id or self.project_id
        if not project_id:
            logger.error("❌ project_id er påkrevd")
            return None

        logger.info(f"📋 Legger til {len(items)} enumeration items...")
        url = f"{self.base_url}/v2/projects/{project_id}/custom-fields/{custom_field_id}"

        payload = {"enumerationItemsToAdd": items}

        try:
            response = requests.patch(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            field = response.json()
            logger.info(f"✅ Enumeration items lagt til")
            return field

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved tillegg av enumeration items: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    # ------------------------------------------
    # Topic Board Statuses
    # ------------------------------------------

    def list_statuses(self, board_id: Optional[str] = None, include_unlinked: bool = False) -> List[Dict]:
        """
        List statuser for et topic board.

        Args:
            board_id: Topic board ID (bruker self.topic_board_id hvis ikke angitt)
            include_unlinked: Inkluder ukoblede statuser

        Returns:
            Liste med statuser
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return []

        logger.info(f"📋 Henter statuser for board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/statuses"
        params = {"includeUnlinked": str(include_unlinked).lower()}

        try:
            response = requests.get(url, headers=self.get_headers(), params=params)
            response.raise_for_status()

            statuses = response.json()
            logger.info(f"✅ Fant {len(statuses)} status(er)")
            return statuses

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av statuser: {e}")
            return []

    def create_status(
        self,
        name: str,
        color: Optional[str] = None,
        status_type: str = "open",
        board_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Opprett ny status for topic board.

        Args:
            name: Navn på status
            color: Farge (hex, f.eks. '#FF0000')
            status_type: Type ('open', 'closed', 'candidate')
            board_id: Topic board ID

        Returns:
            Opprettet status eller None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return None

        logger.info(f"📋 Oppretter status '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/statuses"

        # Default farger basert på status type
        default_colors = {
            "open": "#3498db",      # Blå
            "closed": "#27ae60",    # Grønn
            "candidate": "#f39c12"  # Oransje
        }

        payload = {
            "name": name,
            "type": status_type,
            "color": color or default_colors.get(status_type, "#3498db")
        }

        try:
            response = requests.post(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            status = response.json()
            logger.info(f"✅ Opprettet status: {status.get('name')}")
            return status

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved opprettelse av status: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    def update_status(
        self,
        existing_name: str,
        new_name: Optional[str] = None,
        color: Optional[str] = None,
        status_type: Optional[str] = None,
        board_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Oppdater status for topic board.

        Args:
            existing_name: Eksisterende navn på status
            new_name: Nytt navn (valgfri)
            color: Ny farge (valgfri)
            status_type: Ny type (valgfri)
            board_id: Topic board ID

        Returns:
            Oppdatert status eller None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return None

        logger.info(f"📋 Oppdaterer status '{existing_name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/statuses"

        payload = {"existingName": existing_name}
        if new_name:
            payload["name"] = new_name
        if color:
            payload["color"] = color
        if status_type:
            payload["type"] = status_type

        try:
            response = requests.put(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            status = response.json()
            logger.info(f"✅ Oppdatert status: {status.get('name')}")
            return status

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppdatering av status: {e}")
            return None

    def delete_status(self, name: str, board_id: Optional[str] = None) -> bool:
        """
        Slett status fra topic board.

        Args:
            name: Navn på status som skal slettes
            board_id: Topic board ID

        Returns:
            True hvis vellykket
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return False

        logger.info(f"🗑️ Sletter status '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/statuses"

        payload = {"name": name}

        try:
            response = requests.delete(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            logger.info(f"✅ Slettet status: {name}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved sletting av status: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return False

    # ------------------------------------------
    # Topic Board Types
    # ------------------------------------------

    def list_types(self, board_id: Optional[str] = None, include_unlinked: bool = False) -> List[Dict]:
        """
        List typer for et topic board.

        Args:
            board_id: Topic board ID (bruker self.topic_board_id hvis ikke angitt)
            include_unlinked: Inkluder ukoblede typer

        Returns:
            Liste med typer
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return []

        logger.info(f"📋 Henter typer for board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/types"
        params = {"includeUnlinked": str(include_unlinked).lower()}

        try:
            response = requests.get(url, headers=self.get_headers(), params=params)
            response.raise_for_status()

            types = response.json()
            logger.info(f"✅ Fant {len(types)} type(r)")
            return types

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av typer: {e}")
            return []

    def create_type(
        self,
        name: str,
        color: Optional[str] = None,
        board_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Opprett ny type for topic board.

        Args:
            name: Navn på type
            color: Farge (hex, f.eks. '#3D85C6')
            board_id: Topic board ID

        Returns:
            Opprettet type eller None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return None

        logger.info(f"📋 Oppretter type '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/types"

        payload = {"name": name}
        if color:
            payload["color"] = color

        try:
            response = requests.post(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            topic_type = response.json()
            logger.info(f"✅ Opprettet type: {topic_type.get('name')}")
            return topic_type

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved opprettelse av type: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return None

    def update_type(
        self,
        existing_name: str,
        new_name: Optional[str] = None,
        color: Optional[str] = None,
        board_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Oppdater type for topic board.

        Args:
            existing_name: Eksisterende navn på type
            new_name: Nytt navn (valgfri)
            color: Ny farge (valgfri)
            board_id: Topic board ID

        Returns:
            Oppdatert type eller None
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return None

        logger.info(f"📋 Oppdaterer type '{existing_name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/types"

        payload = {"existingName": existing_name}
        if new_name:
            payload["name"] = new_name
        if color:
            payload["color"] = color

        try:
            response = requests.put(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            topic_type = response.json()
            logger.info(f"✅ Oppdatert type: {topic_type.get('name')}")
            return topic_type

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppdatering av type: {e}")
            return None

    def delete_type(self, name: str, board_id: Optional[str] = None) -> bool:
        """
        Slett type fra topic board.

        Args:
            name: Navn på type som skal slettes
            board_id: Topic board ID

        Returns:
            True hvis vellykket
        """
        board_id = board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID angitt")
            return False

        logger.info(f"🗑️ Sletter type '{name}'...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}/extensions/types"

        payload = {"name": name}

        try:
            response = requests.delete(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            logger.info(f"✅ Slettet type: {name}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved sletting av type: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"   Response: {e.response.text}")
            return False

    # ==========================================
    # PROJECT MANAGEMENT (v2 API)
    # ==========================================

    def get_project_details(self, project_id: str) -> Optional[Dict]:
        """
        Hent detaljer for et v2-prosjekt.
        
        Args:
            project_id: Catenda project ID
            
        Returns:
            Prosjektdata eller None
        """
        logger.info(f"Henter v2-prosjektdetaljer for {project_id}...")
        url = f"{self.base_url}/v2/projects/{project_id}"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            project_data = response.json()
            logger.info(f"✅ Prosjektdetaljer hentet for '{project_data['name']}'")
            return project_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av prosjektdetaljer: {e}")
            return None

    def find_user_in_project(self, project_id: str, email: str) -> Optional[Dict]:
        """
        Finn en brukers detaljer i et prosjekt basert på e-post (username).

        Henter alle medlemmer i prosjektet og søker etter matchende e-post.
        E-post må være registrert i Catenda for prosjektet.

        Args:
            project_id: Catenda project ID
            email: Brukerens e-postadresse (username i Catenda)

        Returns:
            User-objekt med 'id', 'name', 'username', 'company' eller None
        """
        logger.info(f"🔍 Søker etter bruker med e-post '{email}' i prosjekt {project_id}...")

        # Valider e-post-format først
        if not email or '@' not in email:
            logger.warning(f"⚠️ Ugyldig e-post-format: {email}")
            return None

        url = f"{self.base_url}/v2/projects/{project_id}/members"

        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()

            members = response.json()
            logger.info(f"✅ Hentet {len(members)} medlemmer fra prosjektet")

            # Søk etter e-posten (case-insensitive)
            normalized_email = email.lower().strip()
            for member in members:
                # KORRIGERING: Bruker nå det dedikerte 'email'-feltet for matching,
                # som er mer robust enn å anta at 'username' er en e-post.
                if 'user' in member and member['user']:
                    user_details = member['user']
                    email_from_api = user_details.get('email')

                    if email_from_api:
                        user_email = email_from_api.lower().strip()
                        if user_email == normalized_email:
                            logger.info(f"✅ Fant bruker: {user_details.get('name', 'Ukjent navn')} med rolle '{member.get('role')}'")
                            return user_details

            logger.warning(f"⚠️ Fant ikke bruker med e-post '{email}' i prosjektet")
            return None

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved søk etter bruker: {e}")
            return None

    # ==========================================
    # LIBRARY MANAGEMENT (v2 API)
    # ==========================================
    
    def list_libraries(self, project_id: str) -> List[Dict]:
        """
        List alle document libraries i et prosjekt.
        
        Args:
            project_id: Catenda project ID (ikke topic_board_id)
        
        Returns:
            Liste med libraries
        """
        logger.info(f"📚 Henter libraries for prosjekt {project_id}...")
        
        url = f"{self.base_url}/v2/projects/{project_id}/libraries"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            libraries = response.json()
            logger.info(f"✅ Fant {len(libraries)} library/libraries")
            
            for lib in libraries:
                logger.info(f"  - {lib['name']} (ID: {lib['id']}, Type: {lib['type']})")
            
            return libraries
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av libraries: {e}")
            return []
    
    def select_library(self, project_id: str, library_name: str = "Documents") -> bool:
        """
        Velg en library for testing.
        
        Args:
            project_id: Catenda project ID
            library_name: Navn på library (default: "Documents")
        
        Returns:
            True hvis vellykket
        """
        libraries = self.list_libraries(project_id)
        
        if not libraries:
            logger.error("❌ Ingen libraries funnet")
            return False
        
        # Søk etter library med matching navn
        for lib in libraries:
            if lib['name'].lower() == library_name.lower():
                self.library_id = lib['id']
                logger.info(f"✅ Valgte library: {lib['name']}")
                return True
        
        # Hvis ikke funnet, bruk første library
        self.library_id = libraries[0]['id']
        logger.warning(f"⚠️ Library '{library_name}' ikke funnet, bruker: {libraries[0]['name']}")
        return True
    
    # ==========================================
    # TOPIC MANAGEMENT (BCF API)
    # ==========================================

    def get_topic_board_details(self, topic_board_id: Optional[str] = None) -> Optional[Dict]:
        """
        Hent detaljer om et spesifikt topic board (BCF prosjekt).
        
        Args:
            topic_board_id: ID for topic board (bruker self.topic_board_id hvis None)
            
        Returns:
            Topic board data eller None
        """
        board_id = topic_board_id or self.topic_board_id
        if not board_id:
            logger.error("❌ Ingen topic board ID spesifisert")
            return None

        logger.info(f"Henter detaljer for topic board {board_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{board_id}"

        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            board_data = response.json()
            logger.info(f"✅ Detaljer hentet for board '{board_data['name']}'")
            return board_data

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av topic board detaljer: {e}")
            return None
    
    def list_topics(self, limit: int = 10) -> List[Dict]:
        """
        List topics i valgt topic board.
        
        Args:
            limit: Maks antall topics å returnere
        
        Returns:
            Liste med topics
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return []
        
        logger.info(f"📝 Henter topics fra board {self.topic_board_id}...")
        
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            topics = response.json()[:limit]
            logger.info(f"✅ Fant {len(topics)} topic(s)")
            
            for topic in topics:
                logger.info(f"  - {topic['title']} (ID: {topic['guid']}, Status: {topic.get('topic_status', 'N/A')})")
            
            return topics
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av topics: {e}")
            return []
    
    def select_topic(self, topic_index: int = 0) -> bool:
        """
        Velg en topic for testing.
        
        Args:
            topic_index: Index av topic å bruke
        
        Returns:
            True hvis vellykket
        """
        topics = self.list_topics()
        
        if not topics:
            logger.error("❌ Ingen topics funnet")
            return False
        
        if topic_index >= len(topics):
            logger.error(f"❌ Ugyldig topic index: {topic_index}")
            return False
        
        selected = topics[topic_index]
        self.test_topic_id = selected['guid']
        
        logger.info(f"✅ Valgte topic: {selected['title']}")
        return True
    
    def get_topic_details(self, topic_id: Optional[str] = None) -> Optional[Dict]:
        """
        Hent detaljer om en spesifikk topic.
        
        Args:
            topic_id: Topic GUID (bruker self.test_topic_id hvis None)
        
        Returns:
            Topic data eller None
        """
        topic_id = topic_id or self.test_topic_id
        
        if not topic_id:
            logger.error("❌ Ingen topic ID spesifisert")
            return None
        
        logger.info(f"🔍 Henter detaljer for topic {topic_id}...")
        
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            topic = response.json()
            logger.info(f"✅ Topic hentet: {topic['title']}")
            
            return topic
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av topic: {e}")
            return None

    def create_topic(
        self,
        title: str,
        description: Optional[str] = None,
        topic_type: Optional[str] = None,
        topic_status: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Opprett en ny topic i valgt topic board.
        
        Args:
            title: Tittel på topic
            description: Beskrivelse
            topic_type: Type (f.eks. 'Error', 'Request')
            topic_status: Status (f.eks. 'Open', 'Closed')
            
        Returns:
            Topic data eller None
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return None
        
        logger.info(f"📝 Oppretter ny topic i board {self.topic_board_id}...")
        
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics"
        
        payload = {
            "title": title
        }
        if description:
            payload["description"] = description
        if topic_type:
            payload["topic_type"] = topic_type
        if topic_status:
            payload["topic_status"] = topic_status

        try:
            response = requests.post(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()
            
            topic = response.json()
            logger.info(f"✅ Topic opprettet: {topic['title']} (GUID: {topic['guid']})")
            
            return topic
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppretting av topic: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None
    
    # ==========================================
    # DOCUMENT UPLOAD (v2 API - CRITICAL TEST)
    # ==========================================
    
    def upload_document(
        self,
        project_id: str,
        file_path: str,
        document_name: Optional[str] = None,
        folder_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Last opp et dokument til Catenda document library.

        KRITISK TEST: Denne funksjonen returnerer library-item-id som må
        verifiseres mot document_guid i BCF API.

        Args:
            project_id: Catenda project ID
            file_path: Path til fil som skal lastes opp
            document_name: Navn på dokument (bruker filnavn hvis None)
            folder_id: ID til mappe dokumentet skal lastes opp i (None = root)

        Returns:
            Library item data inkludert 'id' (library-item-id)
        """
        if not self.library_id:
            logger.error("❌ Ingen library valgt")
            return None
        
        file_path_obj = Path(file_path)
        
        if not file_path_obj.exists():
            logger.error(f"❌ Fil ikke funnet: {file_path}")
            return None
        
        document_name = document_name or file_path_obj.name
        
        logger.info(f"📤 Laster opp dokument: {document_name}")
        
        url = f"{self.base_url}/v2/projects/{project_id}/libraries/{self.library_id}/items"
        
        # Les fil som binary
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        # Bimsync-Params header (JSON)
        bimsync_params = {
            "name": document_name,
            "document": {
                "type": "file",
                "filename": file_path_obj.name
            },
            "failOnDocumentExists": False
        }

        # Legg til parentId hvis mappe er spesifisert
        if folder_id:
            bimsync_params["parentId"] = folder_id
            logger.info(f"   📁 Laster opp til mappe: {folder_id}")
        
        headers = self.get_headers()
        headers["Content-Type"] = "application/octet-stream"
        headers["Bimsync-Params"] = json.dumps(bimsync_params)
        
        try:
            response = requests.post(url, headers=headers, data=file_data)
            response.raise_for_status()
            
            result = response.json()
            
            # API returnerer en liste med ett element
            if isinstance(result, list) and len(result) > 0:
                library_item = result[0]
            else:
                library_item = result
            
            library_item_id = library_item['id']
            
            logger.info(f"✅ Dokument lastet opp!")
            logger.info(f"   📌 library-item-id: {library_item_id}")
            logger.info(f"   📌 Navn: {library_item['name']}")
            logger.info(f"   📌 Type: {library_item['type']}")
            
            return library_item
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved opplasting av dokument: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None

    # ==========================================
    # FOLDERS (v2 API)
    # ==========================================

    def list_folders(
        self,
        project_id: str,
        parent_id: Optional[str] = None,
        include_subfolders: bool = True
    ) -> List[Dict]:
        """
        List mapper i biblioteket.

        Args:
            project_id: Catenda project ID
            parent_id: ID til parent-mappe (None/root = root-nivå)
            include_subfolders: Inkluder mapper i undermapper (rekursiv)

        Returns:
            Liste med mapper
        """
        if not self.library_id:
            logger.error("❌ Ingen library valgt")
            return []

        url = f"{self.base_url}/v2/projects/{project_id}/libraries/{self.library_id}/items"

        params = {
            "scope": "all",      # Inkluder alle items (også upubliserte)
            "pageSize": "1000"   # Maks antall per side
        }

        # parentId for å filtrere på nivå - "root" for root-mapper
        if parent_id:
            params["parentId"] = parent_id
        else:
            params["parentId"] = "root"  # Eksplisitt root for å få root-mapper

        # Inkluder undermapper rekursivt kun hvis ønsket
        if include_subfolders:
            params["subFolders"] = "true"

        try:
            response = requests.get(url, headers=self.get_headers(), params=params)
            response.raise_for_status()

            items = response.json()

            # Filtrer ut mapper - sjekk document.type=folder (Catenda-struktur)
            folders = [
                item for item in items
                if item.get('document', {}).get('type') == 'folder'
            ]

            logger.info(f"📁 Totalt {len(items)} items, fant {len(folders)} mappe(r)")
            return folders

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av mapper: {e}")
            return []

    def get_library_item(
        self,
        project_id: str,
        item_id: str
    ) -> Optional[Dict]:
        """
        Hent en spesifikk library item (dokument eller mappe) via ID.

        Args:
            project_id: Catenda project ID
            item_id: Library item ID

        Returns:
            Item-data eller None
        """
        if not self.library_id:
            logger.error("❌ Ingen library valgt")
            return None

        url = f"{self.base_url}/v2/projects/{project_id}/libraries/{self.library_id}/items/{item_id}"

        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            item = response.json()
            # Sjekk både top-level type og document.type
            doc_type = item.get('document', {}).get('type') if item.get('document') else None
            logger.info(f"📄 Hentet item: {item.get('name')} (type={item.get('type')}, document.type={doc_type})")
            return item
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av item {item_id}: {e}")
            return None

    def create_folder(
        self,
        project_id: str,
        folder_name: str,
        parent_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Opprett en ny mappe i biblioteket.

        Args:
            project_id: Catenda project ID
            folder_name: Navn på mappen
            parent_id: ID til parent-mappe (None = root)

        Returns:
            Mappe-data inkludert 'id'
        """
        if not self.library_id:
            logger.error("❌ Ingen library valgt")
            return None

        url = f"{self.base_url}/v2/projects/{project_id}/libraries/{self.library_id}/items"

        payload = {
            "name": folder_name,
            "type": "folder"
        }

        if parent_id:
            payload["parentId"] = parent_id

        logger.info(f"📁 Oppretter mappe: {folder_name}")

        try:
            response = requests.post(
                url,
                headers=self.get_headers(),
                json=payload
            )
            response.raise_for_status()

            result = response.json()

            # API kan returnere liste eller objekt
            if isinstance(result, list) and len(result) > 0:
                folder = result[0]
            else:
                folder = result

            logger.info(f"✅ Mappe opprettet: {folder['id']}")
            return folder

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved opprettelse av mappe: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None

    def get_or_create_folder(
        self,
        project_id: str,
        folder_name: str,
        parent_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Hent eksisterende mappe eller opprett ny.

        Args:
            project_id: Catenda project ID
            folder_name: Navn på mappen
            parent_id: ID til parent-mappe (None = root)

        Returns:
            Mappe-ID
        """
        # Sjekk om mappen allerede eksisterer
        folders = self.list_folders(project_id, parent_id)
        for folder in folders:
            if folder.get('name') == folder_name:
                logger.info(f"📁 Fant eksisterende mappe: {folder['id']}")
                return folder['id']

        # Opprett ny mappe
        new_folder = self.create_folder(project_id, folder_name, parent_id)
        if new_folder:
            return new_folder['id']

        return None

    # ==========================================
    # DOCUMENT REFERENCES (BCF API - CRITICAL TEST)
    # ==========================================
    
    def create_document_reference(
        self,
        topic_id: str,
        document_guid: str,
        description: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Opprett en document reference som knytter et dokument til en topic.
        
        KRITISK TEST: Denne funksjonen mottar document_guid som MÅ være
        kompatibel med library-item-id fra upload_document().
        
        Args:
            topic_id: Topic GUID
            document_guid: Document GUID (eller library-item-id?)
            description: Beskrivelse av dokumentet
        
        Returns:
            Document reference data
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return None
        
        logger.info(f"🔗 Oppretter document reference...")
        logger.info(f"   Topic ID: {topic_id}")
        logger.info(f"   Document GUID: {document_guid}")
        
        url = (f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
               f"/topics/{topic_id}/document_references")
        
        payload = {
            "document_guid": document_guid
        }
        
        if description:
            payload["description"] = description
        
        try:
            response = requests.post(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()
            
            doc_ref = response.json()
            
            logger.info(f"✅ Document reference opprettet!")
            logger.info(f"   📌 Reference GUID: {doc_ref['guid']}")
            logger.info(f"   📌 Document GUID: {doc_ref.get('document_guid', 'N/A')}")
            
            return doc_ref
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppretting av document reference: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None
    
    def list_document_references(self, topic_id: Optional[str] = None) -> List[Dict]:
        """
        List alle document references for en topic.
        
        Args:
            topic_id: Topic GUID (bruker self.test_topic_id hvis None)
        
        Returns:
            Liste med document references
        """
        topic_id = topic_id or self.test_topic_id
        
        if not topic_id:
            logger.error("❌ Ingen topic ID spesifisert")
            return []
        
        logger.info(f"📄 Henter document references for topic {topic_id}...")
        
        url = (f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
               f"/topics/{topic_id}/document_references")
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            doc_refs = response.json()
            logger.info(f"✅ Fant {len(doc_refs)} document reference(s)")
            
            for ref in doc_refs:
                logger.info(f"  - {ref.get('description', 'No description')}")
                logger.info(f"    Document GUID: {ref.get('document_guid', 'N/A')}")
                logger.info(f"    URL: {ref.get('url', 'N/A')}")
            
            return doc_refs
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av document references: {e}")
            return []
    
    # ==========================================
    # COMMENTS (BCF API)
    # ==========================================
    
    def create_comment(
        self,
        topic_id: str,
        comment_text: str
    ) -> Optional[Dict]:
        """
        Opprett en kommentar på en topic.
        
        Args:
            topic_id: Topic GUID
            comment_text: Kommentartekst
        
        Returns:
            Comment data
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return None
        
        logger.info(f"💬 Oppretter kommentar på topic {topic_id}...")
        
        url = (f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
               f"/topics/{topic_id}/comments")
        
        payload = {
            "comment": comment_text
        }

        try:
            # Add timeout to prevent hanging (30 seconds total)
            response = requests.post(url, headers=self.get_headers(), json=payload, timeout=30)
            response.raise_for_status()

            comment = response.json()

            logger.info(f"✅ Kommentar opprettet!")
            logger.info(f"   📌 Comment GUID: {comment['guid']}")
            logger.info(f"   📌 Forfatter: {comment.get('author', 'N/A')}")
            
            return comment
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppretting av kommentar: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None

    def get_comments(self, topic_id: str) -> List[Dict]:
        """
        Hent alle kommentarer for en topic.
        
        Args:
            topic_id: Topic GUID
        
        Returns:
            Liste med kommentarer
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return []
            
        logger.info(f"💬 Henter kommentarer for topic {topic_id}...")
        
        url = (f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
               f"/topics/{topic_id}/comments")
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            comments = response.json()
            logger.info(f"✅ Fant {len(comments)} kommentar(er)")
            
            return comments
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av kommentarer: {e}")
            return []

    # ==========================================
    # BIM OBJECT EXTRACTION (BCF API)
    # ==========================================

    def get_all_viewpoints(self, topic_id: str) -> List[Dict]:
        """
        Henter ALLE viewpoints for en topic (både fra kommentarer og direkte på topic)
        
        Returns:
            Liste med viewpoint-objekter, hver inneholder components.selection med IFC GUIDs
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return []

        logger.info(f"Henter viewpoints for topic {topic_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}/viewpoints"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            viewpoints = response.json()
            logger.info("✅ Fant {len(viewpoints)} viewpoint(s).")
            # Log the viewpoints for debugging
            logger.debug(f"Raw viewpoints: {json.dumps(viewpoints, indent=2, ensure_ascii=False)}")
            return viewpoints
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av viewpoints: {e}")
            return []

    def get_viewpoint_details(self, topic_id: str, viewpoint_id: str) -> Optional[Dict]:
        """
        Henter alle detaljer for ett enkelt viewpoint.
        
        Args:
            topic_id: ID for topic viewpointet tilhører
            viewpoint_id: ID for viewpoint som skal hentes
            
        Returns:
            Et komplett viewpoint-objekt eller None
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return None

        logger.info(f"Henter detaljer for viewpoint {viewpoint_id}...")
        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}/viewpoints/{viewpoint_id}"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            viewpoint = response.json()
            logger.info(f"✅ Detaljer hentet for viewpoint {viewpoint_id}.")
            logger.debug(f"Viewpoint details: {json.dumps(viewpoint, indent=2, ensure_ascii=False)}")
            return viewpoint
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av viewpoint-detaljer: {e}")
            return None

    def extract_ifc_guids_from_viewpoints(self, viewpoints: List[Dict]) -> List[Dict]:
        """
        Ekstraherer alle IFC GUIDs fra en liste med viewpoints
        
        Returns:
            Liste med dicts inneholdende:
            - ifc_guid: IfcGloballyUniqueId
            - originating_system: System (f.eks. "Revit")
            - viewpoint_guid: Referanse til viewpoint
        """
        ifc_objects = []
        
        for viewpoint in viewpoints:
            viewpoint_guid = viewpoint.get('guid')
            components = viewpoint.get('components', {})
            
            # Hent fra selection (valgte objekter)
            selection = components.get('selection', [])
            for selected_obj in selection:
                ifc_guid = selected_obj.get('ifc_guid')
                if ifc_guid:
                    ifc_objects.append({
                        'ifc_guid': ifc_guid,
                        'originating_system': selected_obj.get('originating_system'),
                        'authoring_tool_id': selected_obj.get('authoring_tool_id'),
                        'viewpoint_guid': viewpoint_guid,
                        'source': 'selection'
                    })
            
            # Hent også fra coloring (fargelagte objekter)
            coloring = components.get('coloring', [])
            for color_group in coloring:
                for component in color_group.get('components', []):
                    ifc_guid = component.get('ifc_guid')
                    if ifc_guid:
                        ifc_objects.append({
                            'ifc_guid': ifc_guid,
                            'originating_system': component.get('originating_system'),
                            'authoring_tool_id': component.get('authoring_tool_id'),
                            'viewpoint_guid': viewpoint_guid,
                            'source': 'coloring',
                            'color': color_group.get('color')
                        })
            
            # Hent også fra visibility.exceptions (skjulte/viste objekter)
            visibility = components.get('visibility', {})
            exceptions = visibility.get('exceptions', [])
            for exception in exceptions:
                ifc_guid = exception.get('ifc_guid')
                if ifc_guid:
                    ifc_objects.append({
                        'ifc_guid': ifc_guid,
                        'originating_system': exception.get('originating_system'),
                        'authoring_tool_id': exception.get('authoring_tool_id'),
                        'viewpoint_guid': viewpoint_guid,
                        'source': 'visibility_exception'
                    })
        
        # Returner unike objekter (basert på ifc_guid)
        unique_objects = {}
        for obj in ifc_objects:
            guid = obj['ifc_guid']
            if guid not in unique_objects:
                unique_objects[guid] = obj
        
        logger.info(f"✅ Ekstraherte {len(unique_objects)} unike BIM-objekt(er).")
        return list(unique_objects.values())

    def get_viewpoint_selection(self, topic_id: str, viewpoint_id: str) -> List[Dict]:
        """
        Henter selection (IFC GUIDs) for et spesifikt viewpoint.
        Dette er nødvendig fordi hoved-viewpoint-endepunktet ikke returnerer komponenter.
        """
        if not self.topic_board_id:
            return []

        url = f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}/topics/{topic_id}/viewpoints/{viewpoint_id}/selection"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            if response.status_code == 404:
                return []
            response.raise_for_status()
            
            data = response.json()
            # API returnerer et objekt: {"selection": [...]}
            return data.get('selection', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"⚠️ Kunne ikke hente selection for viewpoint {viewpoint_id}: {e}")
            return []

    def get_bim_objects_for_topic(self, topic_id: str) -> List[Dict]:
        """
        Komplett funksjon: Henter alle BIM-objekter koblet til en topic.
        Gjør ekstra oppslag mot /selection endepunktet.
        
        Returns:
            Liste med BIM-objekter med IFC GUIDs og metadata
        """
        # 1. Hent alle viewpoints
        viewpoints = self.get_all_viewpoints(topic_id)
        if not viewpoints:
            return []
        
        all_bim_objects = []
        
        logger.info(f"🔄 Henter detaljert utvalg (selection) for {len(viewpoints)} viewpoint(s)...")

        # 2. For hvert viewpoint, hent spesifikt utvalg (selection)
        for vp in viewpoints:
            vp_guid = vp['guid']
            
            # Hent selection via eget API-kall
            selection = self.get_viewpoint_selection(topic_id, vp_guid)
            
            if selection:
                logger.info(f"   ✅ Fant {len(selection)} objekt(er) i viewpoint {vp_guid}")
                
                for obj in selection:
                    ifc_guid = obj.get('ifc_guid')
                    if ifc_guid:
                        all_bim_objects.append({
                            'ifc_guid': ifc_guid,
                            'originating_system': obj.get('originating_system'),
                            'authoring_tool_id': obj.get('authoring_tool_id'),
                            'viewpoint_guid': vp_guid,
                            'source': 'selection'
                        })
            else:
                logger.info(f"   ℹ️  Ingen utvalg i viewpoint {vp_guid}")

        # 3. Fjern duplikater (samme objekt kan være i flere viewpoints)
        unique_objects = {}
        for obj in all_bim_objects:
            guid = obj['ifc_guid']
            if guid not in unique_objects:
                unique_objects[guid] = obj
        
        result = list(unique_objects.values())
        logger.info(f"✅ Totalt {len(result)} unike BIM-objekt(er) funnet.")
        
        return result

    def get_product_details_by_guid(self, project_id: str, ifc_guid: str) -> Optional[Dict]:
        """
        Henter full produktinformasjon (Psets, Qsets, Materialer) for en gitt IFC GUID.
        """
        logger.info(f"🔍 Slår opp produktdata for GUID: {ifc_guid}...")
        
        # Vi bruker 'POST' for å søke (Query)
        url = f"{self.base_url}/v2/projects/{project_id}/ifc/products"
        
        # Payload for å filtrere på GlobalId
        # Vi ber om å inkludere propertySets, quantitySets og materials i svaret
        payload = {
            "query": {
                "attributes.GlobalId": ifc_guid
            },
            # Vi kan også spesifisere hvilke felt vi vil ha med (1 = inkluder)
            # Hvis vi utelater 'fields', får vi alt som standard.
        }
        
        try:
            response = requests.post(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()
            
            products = response.json()
            
            if products and len(products) > 0:
                product = products[0]
                logger.info(f"✅ Fant produkt: {product.get('attributes', {}).get('Name', 'Uten navn')}")
                logger.info(f"   Type: {product.get('ifcType')}")
                
                # Logg antall property sets for oversikt
                psets = product.get('propertySets', {})
                logger.info(f"   Property Sets: {len(psets)} stk funnet")
                
                return product
            else:
                logger.warning(f"⚠️ Ingen produkter funnet med GUID {ifc_guid}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved produktsøk: {e}")
            return None
    
    # ==========================================
    # TOPIC RELATIONS (BCF API - Catenda Extension)
    # ==========================================

    def list_related_topics(
        self,
        topic_id: str,
        include_project_topics: bool = True
    ) -> List[Dict]:
        """
        List alle relaterte topics for en gitt topic.

        Args:
            topic_id: Topic GUID
            include_project_topics: Inkluder topics fra andre topic boards i samme prosjekt

        Returns:
            Liste med relaterte topics
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return []

        logger.info(f"🔗 Henter relaterte topics for {topic_id}...")

        url = (f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
               f"/topics/{topic_id}/related_topics")

        params = {}
        if include_project_topics:
            params["includeBimsyncProjectTopics"] = "true"

        try:
            response = requests.get(url, headers=self.get_headers(), params=params)
            response.raise_for_status()

            related = response.json()
            logger.info(f"✅ Fant {len(related)} relatert(e) topic(s)")

            for rel in related:
                logger.info(f"  - {rel.get('related_topic_guid')} (Board: {rel.get('bimsync_issue_board_ref')})")

            return related

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av relaterte topics: {e}")
            return []

    def create_topic_relations(
        self,
        topic_id: str,
        related_topic_guids: List[str]
    ) -> bool:
        """
        Opprett relasjoner fra en topic til andre topics.

        Brukes for å knytte f.eks. en forseringssak til fristforlengelsessaker.

        Args:
            topic_id: Topic GUID (f.eks. forseringssaken)
            related_topic_guids: Liste med GUIDs til topics som skal relateres

        Returns:
            True hvis vellykket
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return False

        logger.info(f"🔗 Oppretter {len(related_topic_guids)} relasjon(er) for topic {topic_id}...")

        url = (f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
               f"/topics/{topic_id}/related_topics")

        # Payload er en liste med objekter
        payload = [{"related_topic_guid": guid} for guid in related_topic_guids]

        try:
            response = requests.put(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()

            logger.info(f"✅ Relasjoner opprettet!")
            for guid in related_topic_guids:
                logger.info(f"  - {topic_id} → {guid}")

            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppretting av topic-relasjoner: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return False

    def delete_topic_relation(
        self,
        topic_id: str,
        related_topic_id: str
    ) -> bool:
        """
        Slett en relasjon mellom to topics.

        Args:
            topic_id: Topic GUID
            related_topic_id: GUID til relatert topic som skal fjernes

        Returns:
            True hvis vellykket
        """
        if not self.topic_board_id:
            logger.error("❌ Ingen topic board valgt")
            return False

        logger.info(f"🗑️ Sletter relasjon {topic_id} → {related_topic_id}...")

        url = (f"{self.base_url}/opencde/bcf/3.0/projects/{self.topic_board_id}"
               f"/topics/{topic_id}/related_topics/{related_topic_id}")

        try:
            response = requests.delete(url, headers=self.get_headers())
            response.raise_for_status()

            logger.info("✅ Relasjon slettet")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved sletting av relasjon: {e}")
            return False

    # ==========================================
    # WEBHOOK MANAGEMENT (v2 API)
    # ==========================================
    
    def create_webhook(
        self,
        project_id: str,
        target_url: str,
        event: str = "issue.created",
        name: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Opprett en webhook for prosjektet.
        
        Args:
            project_id: Catenda project ID
            target_url: URL som skal motta webhook notifications
            event: Event type (issue.created, issue.modified, issue.deleted)
            name: Webhook navn
        
        Returns:
            Webhook data
        """
        logger.info(f"🪝 Oppretter webhook for event: {event}")
        
        url = f"{self.base_url}/v2/projects/{project_id}/webhooks/user"
        
        payload = {
            "event": event,
            "target_url": target_url
        }
        
        if name:
            payload["name"] = name
        
        try:
            response = requests.post(url, headers=self.get_headers(), json=payload)
            response.raise_for_status()
            
            webhook = response.json()
            
            logger.info(f"✅ Webhook opprettet!")
            logger.info(f"   📌 Webhook ID: {webhook['id']}")
            logger.info(f"   📌 State: {webhook['state']}")
            
            return webhook
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved oppretting av webhook: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return None
    
    def list_webhooks(self, project_id: str) -> List[Dict]:
        """
        List alle webhooks for prosjektet.
        
        Args:
            project_id: Catenda project ID
        
        Returns:
            Liste med webhooks
        """
        logger.info(f"🪝 Henter webhooks for prosjekt {project_id}...")
        
        url = f"{self.base_url}/v2/projects/{project_id}/webhooks/user"
        
        try:
            response = requests.get(url, headers=self.get_headers())
            response.raise_for_status()
            
            webhooks = response.json()
            logger.info(f"✅ Fant {len(webhooks)} webhook(s)")
            
            for hook in webhooks:
                logger.info(f"  - {hook.get('name', 'Unnamed')} ({hook['event']})")
                logger.info(f"    State: {hook['state']}, Failures: {hook.get('failureCount', 0)}")
            
            return webhooks
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved henting av webhooks: {e}")
            return []

    def delete_webhook(self, project_id: str, webhook_id: str) -> bool:
        """
        Slett en webhook.
        
        Args:
            project_id: Catenda project ID
            webhook_id: ID på webhook som skal slettes
        
        Returns:
            True hvis sletting var vellykket
        """
        logger.info(f"🗑️ Sletter webhook {webhook_id}...")
        
        url = f"{self.base_url}/v2/projects/{project_id}/webhooks/user/{webhook_id}"
        
        try:
            response = requests.delete(url, headers=self.get_headers())
            response.raise_for_status()
            
            if response.status_code == 204:
                logger.info("✅ Webhook slettet")
                return True
            else:
                logger.warning(f"⚠️ Uventet statuskode ved sletting: {response.status_code}")
                return False

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Feil ved sletting av webhook: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return False
    
    # ==========================================
    # CRITICAL TEST: ID MAPPING VERIFICATION
    # ==========================================
    
    def test_id_mapping(
        self,
        project_id: str,
        test_file_path: str,
        topic_id: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        KRITISK TEST: Verifiser om library-item-id kan brukes som document_guid.
        
        Denne testen:
        1. Laster opp et dokument via v2 API (får library-item-id)
        2. Forsøker å bruke library-item-id som document_guid i BCF API
        3. Verifiserer om document reference ble opprettet korrekt
        
        Args:
            project_id: Catenda project ID
            test_file_path: Path til testfil som skal lastes opp
            topic_id: Topic ID å knytte dokumentet til (bruker self.test_topic_id hvis None)
        
        Returns:
            Tuple: (success: bool, message: str)
        """
        topic_id = topic_id or self.test_topic_id
        
        if not topic_id:
            return False, "❌ Ingen topic ID spesifisert"
        
        logger.info("=" * 80)
        logger.info("🔬 KRITISK TEST: ID MAPPING VERIFICATION")
        logger.info("=" * 80)
        
        # Steg 1: Last opp dokument
        logger.info("\n📤 STEG 1: Laster opp testdokument via v2 API...")
        
        library_item = self.upload_document(
            project_id=project_id,
            file_path=test_file_path,
            document_name=f"TEST_ID_MAPPING_{int(time.time())}"
        )
        
        if not library_item:
            return False, "❌ Dokumentopplasting feilet"
        
        library_item_id = library_item['id']
        
        logger.info(f"\n✅ Dokument lastet opp, library-item-id: {library_item_id}")
        logger.info(f"   Format: {len(library_item_id)} tegn")
        
        # Steg 2: Forsøk å bruke library-item-id som document_guid
        logger.info("\n🔗 STEG 2: Forsøker å opprette document reference...")
        logger.info(f"   Bruker library-item-id som document_guid: {library_item_id}")
        
        doc_ref = self.create_document_reference(
            topic_id=topic_id,
            document_guid=library_item_id,
            description="TEST: ID Mapping Verification"
        )
        
        if not doc_ref:
            # Prøv med formatert UUID (legg til bindestreker)
            logger.info("\n🔄 Første forsøk feilet, prøver med formatert UUID...")
            
            if len(library_item_id) == 32:
                # Konverter fra kompakt til standard UUID-format
                formatted_uuid = (
                    f"{library_item_id[0:8]}-"
                    f"{library_item_id[8:12]}-"
                    f"{library_item_id[12:16]}-"
                    f"{library_item_id[16:20]}-"
                    f"{library_item_id[20:32]}"
                )
                
                logger.info(f"   Prøver med formatert UUID: {formatted_uuid}")
                
                doc_ref = self.create_document_reference(
                    topic_id=topic_id,
                    document_guid=formatted_uuid,
                    description="TEST: ID Mapping Verification (formatted UUID)"
                )
                
                if doc_ref:
                    logger.info("=" * 80)
                    logger.info("✅ SUKSESS: ID mapping fungerer med FORMATERT UUID!")
                    logger.info(f"   library-item-id: {library_item_id}")
                    logger.info(f"   document_guid:   {formatted_uuid}")
                    logger.info("   Konklusjon: Konverter til standard UUID-format")
                    logger.info("=" * 80)
                    return True, "ID mapping fungerer med formatert UUID"
            
            return False, "❌ ID mapping fungerer IKKE - begge formater feilet"
        
        # Steg 3: Verifiser at document reference eksisterer
        logger.info("\n✅ Document reference opprettet!")
        logger.info("\n🔍 STEG 3: Verifiserer at dokumentet er synlig i topic...")
        
        doc_refs = self.list_document_references(topic_id)
        
        found = any(ref.get('document_guid') == library_item_id for ref in doc_refs)
        
        if found:
            logger.info("=" * 80)
            logger.info("✅ SUKSESS: ID mapping fungerer direkte!")
            logger.info(f"   library-item-id == document_guid: {library_item_id}")
            logger.info("   Konklusjon: Bruk library-item-id direkte som document_guid")
            logger.info("=" * 80)
            return True, "ID mapping fungerer direkte (kompakt UUID)"
        else:
            logger.warning("⚠️ Document reference opprettet, men ikke funnet i liste")
            logger.warning("   Dette kan være en timing-issue. Venter 2 sekunder...")
            time.sleep(2)
            
            doc_refs = self.list_document_references(topic_id)
            found = any(ref.get('document_guid') == library_item_id for ref in doc_refs)
            
            if found:
                logger.info("=" * 80)
                logger.info("✅ SUKSESS (etter retry): ID mapping fungerer!")
                logger.info("=" * 80)
                return True, "ID mapping fungerer (kompakt UUID, bekreftet etter retry)"
            else:
                return False, "⚠️ Usikker status - document reference opprettet men ikke verifisert"


def create_test_pdf(file_path: str = "test_document.pdf"):
    """
    Opprett en enkel test-PDF for testing.
    
    Args:
        file_path: Path hvor PDF skal lagres
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        
        c = canvas.Canvas(file_path, pagesize=letter)
        c.drawString(100, 750, f"Catenda API Test Document")
        c.drawString(100, 730, f"Generated: {datetime.now().isoformat()}")
        c.drawString(100, 710, "This is a test document for API verification.")
        c.save()
        
        logger.info(f"✅ Test-PDF opprettet: {file_path}")
        return True
        
    except ImportError:
        logger.warning("⚠️ reportlab ikke installert, oppretter dummy tekstfil...")
        
        # Fallback: opprett en tekstfil som kan brukes for testing
        dummy_path = file_path.replace('.pdf', '.txt')
        with open(dummy_path, 'w', encoding='utf-8') as f:
            f.write(f"Catenda API Test Document\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n")
            f.write("This is a test document for API verification.\n")
        
        logger.info(f"✅ Test-fil opprettet: {dummy_path}")
        return dummy_path


def main():
    """
    Hovedfunksjon for testing.
    """
    print("\n" + "=" * 80)
    print("CATENDA API TESTER - POC VERIFICATION")
    print("=" * 80 + "\n")
    
    # ==========================================
    # KONFIGURASJON
    # ==========================================
    print("📝 Konfigurasjon:\n")
    
    client_id = input("Client ID: ").strip()
    
    if not client_id:
        print("❌ Client ID er påkrevd!")
        return
    
    print("\n" + "=" * 80)
    print("VELG AUTENTISERINGSMETODE")
    print("=" * 80)
    print("\n1. Client Credentials Grant (kun for Catenda Boost-kunder)")
    print("2. Authorization Code Grant (for alle brukere)")
    print("3. Jeg har allerede et access token")
    
    auth_choice = input("\nValg (1/2/3): ").strip()
    
    tester = None
    
    if auth_choice == "1":
        # Client Credentials Grant
        client_secret = input("Client Secret: ").strip()
        
        if not client_secret:
            print("❌ Client Secret er påkrevd for Client Credentials Grant!")
            return
        
        tester = CatendaClient(client_id, client_secret)
        
        print("\n" + "=" * 80)
        print("TEST 1: AUTHENTICATION (CLIENT CREDENTIALS)")
        print("=" * 80)
        
        if not tester.authenticate():
            print("\n⚠️  Hvis du ikke er Catenda Boost-kunde, kjør scriptet på nytt")
            print("   og velg Authorization Code Grant (alternativ 2)")
            return
    
    elif auth_choice == "2":
        # Authorization Code Grant
        client_secret = input("Client Secret (valgfritt, kan være tom): ").strip() or None
        redirect_uri = input("Redirect URI: ").strip()
        
        if not redirect_uri:
            print("❌ Redirect URI er påkrevd!")
            return
        
        tester = CatendaClient(client_id, client_secret)
        
        print("\n" + "=" * 80)
        print("TEST 1: AUTHENTICATION (AUTHORIZATION CODE)")
        print("=" * 80)
        
        # Generer authorization URL
        auth_url = tester.get_authorization_url(redirect_uri)
        
        print("\n🌐 Åpne denne URL-en i nettleser:")
        print(f"   {auth_url}\n")
        
        input("Trykk ENTER når du har godkjent og er klar til å fortsette...")
        
        code = input("\nLim inn authorization code fra redirect URL: ").strip()
        
        if not code:
            print("❌ Authorization code er påkrevd!")
            return
        
        if not tester.exchange_code_for_token(code, redirect_uri):
            print("❌ Kunne ikke bytte code mot token")
            return
    
    elif auth_choice == "3":
        # Manuelt token
        access_token = input("Access Token: ").strip()
        
        if not access_token:
            print("❌ Access Token er påkrevd!")
            return
        
        tester = CatendaClient(client_id, access_token=access_token)
        
        print("\n" + "=" * 80)
        print("TEST 1: AUTHENTICATION (MANUAL TOKEN)")
        print("=" * 80)
        print("✅ Access token satt manuelt")
    
    else:
        print("❌ Ugyldig valg!")
        return
    
    # ==========================================
    # TEST 2: PROJECT & TOPIC BOARD DISCOVERY
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 2: PROJECT & TOPIC BOARD DISCOVERY")
    print("=" * 80)
    
    if not tester.select_topic_board(0):
        print("❌ Kunne ikke velge topic board - avbryter testing")
        return
    
    # ==========================================
    # TEST 3: TOPIC LISTING
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 3: TOPIC LISTING")
    print("=" * 80)
    
    if not tester.select_topic(0):
        print("❌ Kunne ikke velge topic - avbryter testing")
        return
    
    # ==========================================
    # TEST 4: LIBRARY DISCOVERY
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 4: LIBRARY DISCOVERY")
    print("=" * 80)
    
    # Merk: project_id er IKKE det samme som topic_board_id
    # For testing, be bruker oppgi project_id
    print("\n⚠️ VIKTIG: Du må oppgi Catenda PROJECT ID (ikke topic_board_id)")
    print("   Dette finner du i Catenda URL: https://catenda.com/projects/<PROJECT_ID>")
    
    project_id = input("\nCatenda Project ID: ").strip()
    
    if not project_id:
        print("❌ Project ID er påkrevd for dokumentopplasting")
        return
    
    if not tester.select_library(project_id, "Documents"):
        print("❌ Kunne ikke velge library - avbryter testing")
        return
    
    # ==========================================
    # TEST 5: CRITICAL ID MAPPING TEST
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 5: CRITICAL ID MAPPING VERIFICATION")
    print("=" * 80)
    
    print("\nOppretter test-dokument...")
    test_file = create_test_pdf("catenda_test_doc.pdf")
    
    if isinstance(test_file, str):
        test_file_path = test_file
    else:
        test_file_path = "catenda_test_doc.pdf"
    
    success, message = tester.test_id_mapping(
        project_id=project_id,
        test_file_path=test_file_path
    )
    
    print("\n" + "=" * 80)
    print("TEST RESULTAT:")
    print("=" * 80)
    print(f"\nStatus: {'✅ SUKSESS' if success else '❌ FEILET'}")
    print(f"Melding: {message}")
    
    # ==========================================
    # TEST 6: COMMENT POSTING
    # ==========================================
    print("\n" + "=" * 80)
    print("TEST 6: COMMENT POSTING")
    print("=" * 80)
    
    tester.create_comment(
        topic_id=tester.test_topic_id,
        comment_text=f"🤖 Test-kommentar fra API tester ({datetime.now().strftime('%Y-%m-%d %H:%M')})"
    )
    
    # ==========================================
    # OPPSUMMERING
    # ==========================================
    print("\n" + "=" * 80)
    print("TESTING FULLFØRT")
    print("=" * 80)
    print("\nSe 'catenda_api_test.log' for komplett testlogg.")
    print("\nViktigste funn:")
    print(f"  • Autentisering: ✅")
    print(f"  • Topic Board valgt: {tester.topic_board_id}")
    print(f"  • Library valgt: {tester.library_id}")
    print(f"  • ID Mapping: {'✅' if success else '❌'} {message}")
    print("=" * 80 + "\n")


