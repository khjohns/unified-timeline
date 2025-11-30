#!/usr/bin/env python3
"""
Konfigurasjon av filtreringsregler for KOE Automation System
"""

# ============================================================================
# FILTRERINGSREGLER
# ============================================================================

# Disse reglene bestemmer hvilke topics/saker som skal prosesseres automatisk
# når webhooks mottas fra Catenda.

# ----------------------------------------------------------------------------
# 1. TOPIC TYPE FILTERING
# ----------------------------------------------------------------------------
# Hvis angitt, prosesseres kun topics med disse topic_type verdiene.
# Sett til None eller tom liste for å akseptere alle typer.
#
# Eksempler på topic_type i Catenda BCF:
# - "Request" (forespørsel/krav)
# - "Issue" (problem/avvik)
# - "Remark" (merknad)
# - "Question" (spørsmål)
# - Custom types definert i Catenda
#
# Eksempel:
# ALLOWED_TOPIC_TYPES = ["Request", "Issue"]  # Kun Request og Issue
# ALLOWED_TOPIC_TYPES = None                  # Alle typer

ALLOWED_TOPIC_TYPES = None  # Alle typer


# ----------------------------------------------------------------------------
# 2. TOPIC BOARD FILTERING
# ----------------------------------------------------------------------------
# Hvis angitt, prosesseres kun topics fra disse board IDs.
# Sett til None eller tom liste for å akseptere alle boards.
#
# Finn board ID i Catenda URL eller via API.
#
# Eksempel:
# ALLOWED_BOARD_IDS = ["board-123", "board-456"]  # Kun disse boards
# ALLOWED_BOARD_IDS = None                        # Alle boards

ALLOWED_BOARD_IDS = ["ffc8413d-1ec5-4834-878b-2955db96e734"]


# ----------------------------------------------------------------------------
# 3. TITLE/DESCRIPTION FILTERING
# ----------------------------------------------------------------------------
# Hvis angitt, prosesseres kun topics hvor tittel eller beskrivelse inneholder
# minst ett av disse nøkkelordene (case-insensitive).
# Sett til None eller tom liste for å akseptere alle.
#
# Eksempel:
# REQUIRED_KEYWORDS = ["KOE", "Endringsordre", "Krav"]
# REQUIRED_KEYWORDS = None  # Ingen keyword-filtrering

REQUIRED_KEYWORDS = None  # Ingen keyword-filtrering


# ----------------------------------------------------------------------------
# 4. AUTHOR FILTERING
# ----------------------------------------------------------------------------
# Hvis angitt, prosesseres kun topics opprettet av disse forfatterne.
# Sett til None eller tom liste for å akseptere alle forfattere.
#
# Eksempel:
# ALLOWED_AUTHORS = ["Entreprenør AS", "Leverandør AB"]
# ALLOWED_AUTHORS = None  # Alle forfattere

ALLOWED_AUTHORS = None  # Alle forfattere


# ----------------------------------------------------------------------------
# 5. LABEL FILTERING
# ----------------------------------------------------------------------------
# Hvis angitt, prosesseres kun topics med minst én av disse labels.
# Sett til None eller tom liste for å akseptere alle.
#
# Eksempel:
# REQUIRED_LABELS = ["KOE", "Endringsordre", "Priority-High"]
# REQUIRED_LABELS = None  # Ingen label-filtrering

REQUIRED_LABELS = None  # Ingen label-filtrering


# ----------------------------------------------------------------------------
# 6. CUSTOM FILTERING FUNCTION
# ----------------------------------------------------------------------------
# For avansert filtrering, definer en egen funksjon.
# Funksjonen mottar topic-data og returnerer True hvis topic skal prosesseres.
#
# Eksempel:
# def custom_filter(topic_data):
#     # Kun topics med "KOE" i tittel og opprettet på dagtid
#     hour = datetime.now().hour
#     has_koe = "KOE" in topic_data.get('title', '').upper()
#     is_daytime = 8 <= hour < 17
#     return has_koe and is_daytime

def custom_filter(topic_data: dict) -> bool:
    """
    Custom filtreringsfunksjon for avanserte scenarioer.
    
    Args:
        topic_data: Dictionary med topic-informasjon fra webhook
        
    Returns:
        True hvis topic skal prosesseres, False ellers
    """
    # Default: Aksepter alle (returner True)
    # Endre denne for custom logikk
    return True


# ============================================================================
# LOGGING AV FILTRERTE TOPICS
# ============================================================================

# Skal filtrerte (ignorerte) topics logges?
LOG_FILTERED_TOPICS = True

# Skal filtrerte topics logges til separat fil?
LOG_FILTERED_TO_FILE = True
FILTERED_LOG_FILE = "filtered_topics.log"


# ============================================================================
# ACTIONS FOR FILTRERTE TOPICS
# ============================================================================

# Hva skal skje med filtrerte topics?
# - "ignore": Bare ignorer
# - "log": Logg til fil
# - "comment": Legg til kommentar i Catenda om at topic ikke prosesseres automatisk
# - "label": Legg til label i Catenda (f.eks. "auto-ignored")

ACTION_ON_FILTERED = "log"  # Kun logg


# ============================================================================
# NOTIFICATION SETTINGS
# ============================================================================

# Send e-postvarsel når topic filtreres bort?
EMAIL_NOTIFICATION_ON_FILTERED = False
EMAIL_RECIPIENTS = []  # ["admin@example.com"]

# Send e-postvarsel når topic prosesseres?
EMAIL_NOTIFICATION_ON_PROCESSED = False


# ============================================================================
# VALIDERING
# ============================================================================

def validate_config():
    """Valider konfigurasjon ved oppstart"""
    
    # Sjekk at ACTION_ON_FILTERED er gyldig
    valid_actions = ["ignore", "log", "comment", "label"]
    if ACTION_ON_FILTERED not in valid_actions:
        raise ValueError(f"ACTION_ON_FILTERED må være en av: {valid_actions}")
    
    # Sjekk at email-konfig er OK hvis notifikasjoner er på
    if (EMAIL_NOTIFICATION_ON_FILTERED or EMAIL_NOTIFICATION_ON_PROCESSED):
        if not EMAIL_RECIPIENTS:
            raise ValueError("EMAIL_RECIPIENTS må settes hvis e-postvarslinger er aktivert")
    
    return True


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def should_process_topic(topic_data: dict) -> tuple[bool, str]:
    """
    Sjekk om topic skal prosesseres basert på filtreringsregler.
    
    Args:
        topic_data: Dictionary med topic-informasjon
        
    Returns:
        (bool, str): (skal_prosesseres, årsak_hvis_ikke)
    """
    
    # 1. Topic Type Filter
    if ALLOWED_TOPIC_TYPES:
        topic_type = topic_data.get('topic_type') or topic_data.get('type')
        if topic_type not in ALLOWED_TOPIC_TYPES:
            return False, f"Topic type '{topic_type}' ikke i allowed list: {ALLOWED_TOPIC_TYPES}"
    
    # 2. Board Filter
    if ALLOWED_BOARD_IDS:
        board_id = topic_data.get('board_id')
        if board_id: # Ensure board_id is not None or empty
            # Normalize the board_id from webhook (remove hyphens) for comparison
            normalized_board_id = board_id.replace('-', '')
            
            # Normalize the allowed IDs for comparison
            normalized_allowed_board_ids = [id.replace('-', '') for id in ALLOWED_BOARD_IDS]

            if normalized_board_id not in normalized_allowed_board_ids:
                return False, f"Board '{board_id}' ikke i allowed list"
        else:
            return False, "Board ID mangler i topic_data for filtrering"
    
    # 3. Keyword Filter
    if REQUIRED_KEYWORDS:
        title = (topic_data.get('title') or '').lower()
        description = (topic_data.get('description') or '').lower()
        has_keyword = any(
            keyword.lower() in title or keyword.lower() in description
            for keyword in REQUIRED_KEYWORDS
        )
        if not has_keyword:
            return False, f"Ingen required keywords funnet: {REQUIRED_KEYWORDS}"
    
    # 4. Author Filter
    if ALLOWED_AUTHORS:
        author = topic_data.get('creation_author') or topic_data.get('author')
        if author not in ALLOWED_AUTHORS:
            return False, f"Author '{author}' ikke i allowed list"
    
    # 5. Label Filter
    if REQUIRED_LABELS:
        labels = topic_data.get('labels', [])
        has_label = any(label in REQUIRED_LABELS for label in labels)
        if not has_label:
            return False, f"Ingen required labels funnet: {REQUIRED_LABELS}"
    
    # 6. Custom Filter
    if not custom_filter(topic_data):
        return False, "Custom filter returnerte False"
    
    # Alle filtre passert!
    return True, ""


def get_filter_summary() -> str:
    """Generer tekstoppsummering av aktive filtre"""
    
    filters = []
    
    if ALLOWED_TOPIC_TYPES:
        filters.append(f"Topic types: {', '.join(ALLOWED_TOPIC_TYPES)}")
    
    if ALLOWED_BOARD_IDS:
        filters.append(f"Boards: {', '.join(ALLOWED_BOARD_IDS)}")
    
    if REQUIRED_KEYWORDS:
        filters.append(f"Keywords: {', '.join(REQUIRED_KEYWORDS)}")
    
    if ALLOWED_AUTHORS:
        filters.append(f"Authors: {', '.join(ALLOWED_AUTHORS)}")
    
    if REQUIRED_LABELS:
        filters.append(f"Labels: {', '.join(REQUIRED_LABELS)}")
    
    if not filters:
        return "Ingen filtre aktive (alle topics prosesseres)"
    
    return "Aktive filtre:\n  - " + "\n  - ".join(filters)
