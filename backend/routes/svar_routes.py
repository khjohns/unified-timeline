"""
Svar Routes Blueprint

Endpoints for:
- Submitting BH Svar (client response) form
"""
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify

from lib.auth import require_csrf
from lib.security.rate_limiter import limit_submit
from core.generated_constants import (
    KOE_STATUS, BH_SVAR_STATUS,
    get_vederlag_svar_label, get_frist_svar_label,
    krever_revisjon
)

logger = logging.getLogger(__name__)

# Create Blueprint
svar_bp = Blueprint('svar', __name__)


@svar_bp.route('/api/svar-submit', methods=['POST'])
@require_csrf
@limit_submit  # Rate limiting (10/min default)
def submit_svar():
    """
    Submit BH Svar (client response) form.

    This is the third step in the KOE workflow where the client (byggherre)
    responds to the contractor's KOE with approval, partial approval, or rejection.

    Request Body:
        sakId: Case identifier
        formData: Complete form data including bh_svar_revisjoner
        topicGuid: Catenda topic GUID for posting comment

    Returns:
        JSON: {"success": True}

    Business Logic:
        1. Auto-populate BH svar submission date and signature
        2. Determine if revision is required based on response
        3. Save form data to database
        4. If revision required: create new KOE revision + new BH svar template
        5. Log event to history
        6. Post comment to Catenda with decision details and magic link
    """
    # Import here to avoid circular imports
    from app import get_system
    from lib.auth import MagicLinkManager

    logger.info("📥 Mottok svar-submit request")
    sys = get_system()
    magic_link_mgr = MagicLinkManager()

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

    # Build Catenda comment
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

    return jsonify({"success": True}), 200
