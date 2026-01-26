"""
Letter Generation API Routes.

Provides endpoints for generating formal letters as PDF.
"""
from flask import Blueprint, request, jsonify, Response

from services.letter_pdf_generator import (
    get_letter_pdf_generator,
    BrevInnhold,
    BrevPart,
    BrevReferanser,
    BrevSeksjoner,
)
from utils.logger import get_logger

logger = get_logger(__name__)

letter_bp = Blueprint('letter', __name__)


@letter_bp.route('/api/letter/generate', methods=['POST'])
def generate_letter_pdf():
    """
    Generate a formal letter PDF from structured content.

    Request body:
    {
        "brev_innhold": {
            "tittel": "Vedr: Ansvarsgrunnlag - Sak KOE-123",
            "mottaker": {
                "navn": "Entreprenør AS",
                "rolle": "TE",
                "adresse": "Gateveien 1, 0123 Oslo",
                "orgnr": "123456789"
            },
            "avsender": {
                "navn": "Oslobygg KF",
                "rolle": "BH",
                "adresse": "Rådhuset, 0037 Oslo",
                "orgnr": "987654321"
            },
            "referanser": {
                "sak_id": "KOE-20240115-001",
                "sakstittel": "Endring i fundamentering",
                "event_id": "abc123-def456",
                "spor_type": "grunnlag",
                "dato": "2024-01-15T10:30:00Z",
                "krav_dato": "2024-01-10T09:00:00Z"
            },
            "seksjoner": {
                "innledning": "Det vises til krav om...",
                "begrunnelse": "Byggherren har vurdert...",
                "avslutning": "Med vennlig hilsen..."
            }
        }
    }

    Response:
        PDF file as binary with Content-Type: application/pdf
    """
    try:
        payload = request.get_json()

        if not payload or 'brev_innhold' not in payload:
            return jsonify({
                "success": False,
                "error": "MISSING_CONTENT",
                "message": "Request must include 'brev_innhold' object"
            }), 400

        raw_innhold = payload['brev_innhold']

        # Parse and validate input
        try:
            brev_innhold = BrevInnhold(
                tittel=raw_innhold.get('tittel', ''),
                mottaker=BrevPart(**raw_innhold.get('mottaker', {})),
                avsender=BrevPart(**raw_innhold.get('avsender', {})),
                referanser=BrevReferanser(**raw_innhold.get('referanser', {})),
                seksjoner=BrevSeksjoner(**raw_innhold.get('seksjoner', {})),
            )
        except Exception as e:
            logger.warning(f"Invalid letter content: {e}")
            return jsonify({
                "success": False,
                "error": "INVALID_CONTENT",
                "message": f"Invalid letter content: {str(e)}"
            }), 400

        # Generate PDF
        generator = get_letter_pdf_generator()
        pdf_bytes = generator.generate_letter_pdf(brev_innhold)

        # Generate filename
        sak_id = brev_innhold.referanser.sak_id
        spor_type = brev_innhold.referanser.spor_type
        filename = f"brev-{sak_id}-{spor_type}.pdf"

        logger.info(f"Generated letter PDF: {filename} ({len(pdf_bytes)} bytes)")

        # Return PDF as binary response
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Length': str(len(pdf_bytes)),
            }
        )

    except Exception as e:
        logger.error(f"Failed to generate letter PDF: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "GENERATION_FAILED",
            "message": "Failed to generate PDF. Please try again."
        }), 500
