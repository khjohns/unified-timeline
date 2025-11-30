"""
KOE Routes Blueprint

Endpoints for:
- Submitting KOE (change order request) form
- Submitting revised KOE after client feedback
- Uploading PDF document to Catenda
"""
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify

from lib.auth import require_csrf
from core.generated_constants import BH_SVAR_STATUS

logger = logging.getLogger(__name__)

# Create Blueprint
koe_bp = Blueprint('koe', __name__)


@koe_bp.route('/api/koe-submit', methods=['POST'])
@require_csrf
def submit_koe():
    """
    Submit KOE (change order request) form.

    This is the second step in the KOE workflow where the contractor
    submits detailed claims for compensation and/or deadline extension.

    Request Body:
        sakId: Case identifier
        formData: Complete form data including koe_revisjoner
        topicGuid: Catenda topic GUID for posting comment

    Returns:
        JSON: {"success": True, "nextMode": "svar"}

    Business Logic:
        1. Auto-populate KOE submission date and signature
        2. Save form data to database
        3. Ensure first BH svar-revisjon exists (empty template)
        4. Log event to history
        5. Post comment to Catenda with claim details and magic link
    """
    # Import here to avoid circular imports
    from app import get_system
    from lib.auth import MagicLinkManager

    logger.info("📥 Mottok koe-submit request")
    sys = get_system()
    magic_link_mgr = MagicLinkManager()

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

    # Hent krav-detaljer for Catenda comment
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


@koe_bp.route('/api/cases/<string:sakId>/revidering', methods=['POST'])
def submit_revidering(sakId):
    """
    Handle submission of revised KOE from contractor.

    This endpoint is called when the client has partially rejected the KOE
    and the contractor submits a revised version.

    Args:
        sakId: Case identifier (from URL path)

    Request Body:
        formData: Complete form data including revised koe_revisjoner

    Returns:
        JSON: {"success": True, "nextMode": "svar"}

    Business Logic:
        1. Auto-populate revised KOE submission date and signature
        2. Save form data to database
        3. Log event to history
        4. Post comment to Catenda with revised claim details
    """
    # Import here to avoid circular imports
    from app import get_system
    from lib.auth import MagicLinkManager

    logger.info(f"📥 Mottok revidering-submit request for sak {sakId}")
    sys = get_system()
    magic_link_mgr = MagicLinkManager()

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

    # Hent krav-detaljer for Catenda comment
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


@koe_bp.route('/api/cases/<string:sakId>/pdf', methods=['POST'])
def upload_pdf(sakId):
    """
    Upload PDF document to Catenda.

    This endpoint receives a base64-encoded PDF from the frontend
    and uploads it to the corresponding Catenda topic.

    Args:
        sakId: Case identifier (from URL path)

    Request Body:
        pdfBase64: Base64-encoded PDF data
        filename: Filename for the PDF
        topicGuid: Catenda topic GUID where PDF should be uploaded

    Returns:
        JSON: {"success": True, ...} or {"success": False, "error": "..."}

    Business Logic:
        1. Validate PDF data and topic GUID
        2. Decode base64 PDF
        3. Upload to Catenda document library
        4. Link document to topic
    """
    # Import here to avoid circular imports
    from app import get_system

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
