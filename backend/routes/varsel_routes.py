"""
Varsel Routes Blueprint

Endpoints for:
- Submitting Varsel (notification) form
"""
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify

from lib.auth import require_csrf
from lib.security.rate_limiter import limit_submit
from core.generated_constants import KOE_STATUS

logger = logging.getLogger(__name__)

# Create Blueprint
varsel_bp = Blueprint('varsel', __name__)


@varsel_bp.route('/api/varsel-submit', methods=['POST'])
@require_csrf  # CSRF beskyttelse
@limit_submit  # Rate limiting (10/min default)
def submit_varsel():
    """
    Submit Varsel (notification) form.

    This is the first step in the KOE workflow where the contractor notifies
    the client about a discovered issue that may lead to a change order request.

    Request Body:
        sakId: Case identifier
        formData: Complete form data including varsel section
        topicGuid: Catenda topic GUID for posting comment

    Returns:
        JSON: {"success": True, "nextMode": "koe"}

    Business Logic:
        1. Auto-populate varsel submission date
        2. Save form data to database
        3. Ensure first KOE revision exists (empty template)
        4. Log event to history
        5. Post comment to Catenda with magic link
    """
    # Import here to avoid circular imports
    from app import get_system

    logger.info("📥 Mottok varsel-submit request")
    sys = get_system()
    magic_link_mgr = sys.magic_links

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

    # Post kommentar til Catenda
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

    # CRITICAL: Set topic_board_id before creating comment
    # Retrieve board_id from case data to enable Catenda API call
    case_data = sys.db.get_form_data(sak_id)
    if case_data and 'sak' in case_data:
        board_id = case_data['sak'].get('catenda_board_id')
        if board_id:
            sys.catenda.topic_board_id = board_id
            logger.info(f"✅ Board ID set to: {board_id}")
        else:
            logger.warning(f"⚠️ No board_id found in case {sak_id}")
    else:
        logger.warning(f"⚠️ Could not retrieve case data for {sak_id}")

    sys.catenda.create_comment(topic_guid, comment_text)

    return jsonify({"success": True, "nextMode": "koe"}), 200
