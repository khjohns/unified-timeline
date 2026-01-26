"""
Letter PDF Generator using WeasyPrint.

Generates formal letters (brev) as PDF from structured content.
Uses HTML/CSS templates for consistent styling with the frontend.
"""
from typing import Optional
from pathlib import Path
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from io import BytesIO

from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel

from utils.logger import get_logger

logger = get_logger(__name__)


class BrevPart(BaseModel):
    """Recipient/sender information."""
    navn: str
    rolle: str  # 'TE' or 'BH'
    adresse: Optional[str] = None
    orgnr: Optional[str] = None


class BrevReferanser(BaseModel):
    """Reference information for the letter."""
    sak_id: str
    sakstittel: str
    event_id: str
    spor_type: str
    dato: str
    krav_dato: Optional[str] = None


class BrevSeksjoner(BaseModel):
    """Letter content sections."""
    innledning: str
    begrunnelse: str
    avslutning: str


class BrevInnhold(BaseModel):
    """Complete letter content for PDF generation."""
    tittel: str
    mottaker: BrevPart
    avsender: BrevPart
    referanser: BrevReferanser
    seksjoner: BrevSeksjoner


def _get_norwegian_date() -> str:
    """Get current date formatted in Norwegian."""
    utc_now = datetime.now(timezone.utc)
    norwegian_tz = ZoneInfo("Europe/Oslo")
    local_time = utc_now.astimezone(norwegian_tz)

    # Norwegian month names
    months = [
        'januar', 'februar', 'mars', 'april', 'mai', 'juni',
        'juli', 'august', 'september', 'oktober', 'november', 'desember'
    ]

    return f"{local_time.day}. {months[local_time.month - 1]} {local_time.year}"


def _format_date_norwegian(date_str: Optional[str]) -> str:
    """Format ISO date string to Norwegian locale."""
    if not date_str:
        return _get_norwegian_date()

    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        norwegian_tz = ZoneInfo("Europe/Oslo")
        local_time = dt.astimezone(norwegian_tz)

        months = [
            'januar', 'februar', 'mars', 'april', 'mai', 'juni',
            'juli', 'august', 'september', 'oktober', 'november', 'desember'
        ]

        return f"{local_time.day}. {months[local_time.month - 1]} {local_time.year}"
    except Exception:
        return date_str


class LetterPdfGenerator:
    """
    Generate formal letter PDFs using WeasyPrint.

    Uses Jinja2 templates with HTML/CSS for layout.
    Produces A4 PDFs matching the frontend design.
    """

    def __init__(self):
        """Initialize the generator with Jinja2 environment."""
        # Get template directory (relative to this file)
        template_dir = Path(__file__).parent.parent / 'templates'

        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml'])
        )

        # Get static files directory for logo
        self.static_dir = Path(__file__).parent.parent.parent / 'public' / 'logos'

    def generate_letter_pdf(
        self,
        brev_innhold: BrevInnhold,
        output_path: Optional[str] = None
    ) -> bytes:
        """
        Generate PDF from letter content.

        Args:
            brev_innhold: Structured letter content
            output_path: Optional file path to write PDF (also returns bytes)

        Returns:
            PDF as bytes
        """
        try:
            template = self.env.get_template('letter_template.html')

            # Find logo path
            logo_path = self.static_dir / 'Oslo-logo-RGB.png'
            if not logo_path.exists():
                # Try alternative paths
                alt_paths = [
                    Path(__file__).parent.parent.parent / 'src' / 'assets' / 'logos' / 'Oslo-logo-RGB.png',
                    Path(__file__).parent.parent / 'static' / 'logos' / 'Oslo-logo-RGB.png',
                ]
                for alt in alt_paths:
                    if alt.exists():
                        logo_path = alt
                        break

            # Render HTML
            html_content = template.render(
                tittel=brev_innhold.tittel,
                mottaker=brev_innhold.mottaker.model_dump(),
                avsender=brev_innhold.avsender.model_dump(),
                referanser=brev_innhold.referanser.model_dump(),
                seksjoner=brev_innhold.seksjoner.model_dump(),
                dato=_format_date_norwegian(brev_innhold.referanser.dato),
                generert_dato=_get_norwegian_date(),
                logo_path=f'file://{logo_path}' if logo_path.exists() else '',
            )

            # Generate PDF
            html = HTML(string=html_content)

            if output_path:
                html.write_pdf(output_path)
                logger.info(f"Letter PDF written to: {output_path}")

                # Also read and return bytes
                with open(output_path, 'rb') as f:
                    return f.read()
            else:
                # Generate to BytesIO
                pdf_buffer = BytesIO()
                html.write_pdf(pdf_buffer)
                pdf_bytes = pdf_buffer.getvalue()
                logger.info(f"Letter PDF generated: {len(pdf_bytes)} bytes")
                return pdf_bytes

        except Exception as e:
            logger.error(f"Failed to generate letter PDF: {e}", exc_info=True)
            raise


# Singleton instance
_generator: Optional[LetterPdfGenerator] = None


def get_letter_pdf_generator() -> LetterPdfGenerator:
    """Get or create the letter PDF generator instance."""
    global _generator
    if _generator is None:
        _generator = LetterPdfGenerator()
    return _generator
