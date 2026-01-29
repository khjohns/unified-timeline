"""
Letter PDF Generator using ReportLab.

Generates formal letters (brev) as PDF from structured content.
Pure Python - no system dependencies required.
"""
import re
from typing import Optional
from pathlib import Path
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
)
from reportlab.lib.enums import TA_RIGHT, TA_JUSTIFY
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

    months = [
        'januar', 'februar', 'mars', 'april', 'mai', 'juni',
        'juli', 'august', 'september', 'oktober', 'november', 'desember'
    ]

    return f"{local_time.day}. {months[local_time.month - 1]} {local_time.year}"


def _markdown_to_reportlab(text: str) -> str:
    """
    Convert markdown to ReportLab Paragraph-compatible HTML.

    Supports:
    - Headers: #, ##, ###
    - Bold: **text** or __text__
    - Italic: *text* or _text_
    - Strikethrough: ~~text~~
    - Inline code: `code`
    - Links: [text](url) -> text (url)
    - Lists: - item, 1. item
    - Line breaks

    Note: Tables are not supported in ReportLab Paragraph.
    """
    # Process line by line for headers and lists
    lines = text.split('\n')
    result_lines = []

    for line in lines:
        # Headers: ### must come before ## which must come before #
        if line.startswith('### '):
            line = f'<font size="11"><b>{line[4:]}</b></font>'
        elif line.startswith('## '):
            line = f'<font size="12"><b>{line[3:]}</b></font>'
        elif line.startswith('# '):
            line = f'<font size="14"><b>{line[2:]}</b></font>'
        # Unordered lists: - item -> • item (only if followed by space and text)
        elif re.match(r'^[\t ]*[-*+] \S', line):
            line = re.sub(r'^[\t ]*([-*+]) ', '    • ', line)
        # Ordered lists: 1. item -> 1. item (with indent)
        elif re.match(r'^[\t ]*\d+\. \S', line):
            line = re.sub(r'^[\t ]*(\d+)\. ', r'    \1. ', line)

        # Links: [text](url) -> text (url) - must come before italic processing
        line = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 (\2)', line)

        # Bold: **text** -> <b>text</b> (text must have content)
        line = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', line)
        # Bold: __text__ -> <b>text</b> (text must have content, not just underscores)
        line = re.sub(r'__([^_]+)__', r'<b>\1</b>', line)

        # Italic: *text* -> <i>text</i> (single asterisk, text must have content)
        line = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', line)
        # Italic: _text_ -> <i>text</i> (single underscore, text must have content)
        line = re.sub(r'(?<!_)_([^_]+)_(?!_)', r'<i>\1</i>', line)

        # Strikethrough: ~~text~~ -> <strike>text</strike>
        line = re.sub(r'~~([^~]+)~~', r'<strike>\1</strike>', line)

        # Inline code: `code` -> monospace font with subtle background color
        line = re.sub(r'`([^`]+)`', r'<font face="Courier" color="#C7254E">\1</font>', line)

        result_lines.append(line)

    # Join with <br/> for line breaks
    return '<br/>'.join(result_lines)


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


# Colors matching the original design
COLORS = {
    'primary': HexColor('#2A2859'),      # Dark blue for titles
    'text': HexColor('#2C2C2C'),          # Main text
    'text_light': HexColor('#4D4D4D'),    # Secondary text
    'text_muted': HexColor('#666666'),    # Muted text
    'border': HexColor('#E6E6E6'),        # Light border
}


class LetterPdfGenerator:
    """
    Generate formal letter PDFs using ReportLab.

    Pure Python implementation - no system dependencies.
    Produces A4 PDFs matching the original design.
    """

    def __init__(self):
        """Initialize the generator with styles."""
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

        # Get static files directory for logo
        self.static_dir = Path(__file__).parent.parent.parent / 'public' / 'logos'

    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        # Header date style
        self.styles.add(ParagraphStyle(
            'HeaderDate',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=COLORS['text'],
            alignment=TA_RIGHT,
        ))

        # Header reference style
        self.styles.add(ParagraphStyle(
            'HeaderRef',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=COLORS['text_muted'],
            alignment=TA_RIGHT,
        ))

        # Recipient label
        self.styles.add(ParagraphStyle(
            'RecipientLabel',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=COLORS['text_muted'],
            spaceAfter=2*mm,
        ))

        # Recipient name
        self.styles.add(ParagraphStyle(
            'RecipientName',
            parent=self.styles['Normal'],
            fontSize=11,
            fontName='Helvetica-Bold',
            textColor=COLORS['text'],
            spaceAfter=1*mm,
        ))

        # Recipient detail
        self.styles.add(ParagraphStyle(
            'RecipientDetail',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=COLORS['text_light'],
            spaceAfter=1*mm,
        ))

        # Subject/title style
        self.styles.add(ParagraphStyle(
            'Subject',
            parent=self.styles['Normal'],
            fontSize=12,
            fontName='Helvetica-Bold',
            textColor=COLORS['primary'],
            spaceAfter=10*mm,
        ))

        # Body text style
        self.styles.add(ParagraphStyle(
            'LetterBody',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=COLORS['text'],
            alignment=TA_JUSTIFY,
            leading=14,
            spaceAfter=8*mm,
        ))

        # Footer style
        self.styles.add(ParagraphStyle(
            'Footer',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=COLORS['text_muted'],
        ))

    def _find_logo_path(self) -> Optional[Path]:
        """Find the logo file."""
        logo_path = self.static_dir / 'Oslo-logo-sort-RGB.png'
        if logo_path.exists():
            return logo_path

        # Try alternative paths
        alt_paths = [
            Path(__file__).parent.parent.parent / 'src' / 'assets' / 'logos' / 'Oslo-logo-sort-RGB.png',
            Path(__file__).parent.parent / 'static' / 'logos' / 'Oslo-logo-sort-RGB.png',
        ]
        for alt in alt_paths:
            if alt.exists():
                return alt

        return None

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
            # Create PDF buffer
            pdf_buffer = BytesIO()

            # Create document with margins
            doc = SimpleDocTemplate(
                pdf_buffer,
                pagesize=A4,
                leftMargin=50,
                rightMargin=50,
                topMargin=40,
                bottomMargin=60,
            )

            # Build content
            story = []

            # --- Header section ---
            story.extend(self._build_header(brev_innhold))

            # --- Recipient section ---
            story.extend(self._build_recipient(brev_innhold.mottaker))

            # --- Subject line with border ---
            story.append(Paragraph(brev_innhold.tittel, self.styles['Subject']))

            # Add a line under the subject
            story.append(Spacer(1, 2*mm))

            # --- Content sections ---
            if brev_innhold.seksjoner.innledning:
                story.append(Paragraph(
                    _markdown_to_reportlab(brev_innhold.seksjoner.innledning),
                    self.styles['LetterBody']
                ))

            if brev_innhold.seksjoner.begrunnelse:
                story.append(Paragraph(
                    _markdown_to_reportlab(brev_innhold.seksjoner.begrunnelse),
                    self.styles['LetterBody']
                ))

            if brev_innhold.seksjoner.avslutning:
                story.append(Paragraph(
                    _markdown_to_reportlab(brev_innhold.seksjoner.avslutning),
                    self.styles['LetterBody']
                ))

            # Build PDF
            doc.build(
                story,
                onFirstPage=lambda canvas, doc: self._draw_footer(
                    canvas, doc, brev_innhold
                ),
                onLaterPages=lambda canvas, doc: self._draw_footer(
                    canvas, doc, brev_innhold
                ),
            )

            # Get PDF bytes
            pdf_bytes = pdf_buffer.getvalue()

            # Optionally write to file
            if output_path:
                with open(output_path, 'wb') as f:
                    f.write(pdf_bytes)
                logger.info(f"Letter PDF written to: {output_path}")

            logger.info(f"Letter PDF generated: {len(pdf_bytes)} bytes")
            return pdf_bytes

        except Exception as e:
            logger.error(f"Failed to generate letter PDF: {e}", exc_info=True)
            raise

    def _build_header(self, brev_innhold: BrevInnhold) -> list:
        """Build the header section with logo and references."""
        elements = []

        # Format date
        dato = _format_date_norwegian(brev_innhold.referanser.dato)

        # Try to find logo
        logo_path = self._find_logo_path()

        # Create header table (logo left, date/ref right)
        header_data = []

        # Logo cell
        if logo_path:
            try:
                # Get image dimensions to preserve aspect ratio
                from reportlab.lib.utils import ImageReader
                img_reader = ImageReader(str(logo_path))
                img_width, img_height = img_reader.getSize()
                aspect_ratio = img_width / img_height
                # Target height 80pt (matches frontend), calculate width from aspect ratio
                target_height = 80
                target_width = target_height * aspect_ratio
                logo = Image(str(logo_path), width=target_width, height=target_height)
                logo_cell = logo
            except Exception:
                logo_cell = Paragraph("Oslo kommune", self.styles['Normal'])
        else:
            logo_cell = Paragraph("Oslo kommune", self.styles['Normal'])

        # Date and reference cell
        date_ref = f"""
        <para align="right">
        <font size="10">{dato}</font><br/>
        <font size="9" color="#666666">Vår ref: {brev_innhold.referanser.sak_id}</font><br/>
        <font size="9" color="#666666">Deres ref: {brev_innhold.referanser.event_id[:8]}</font>
        </para>
        """
        date_cell = Paragraph(date_ref, self.styles['Normal'])

        header_data.append([logo_cell, date_cell])

        # Create table
        page_width = A4[0] - 100  # Account for margins
        header_table = Table(
            header_data,
            colWidths=[page_width * 0.5, page_width * 0.5]
        )
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('LINEBELOW', (0, 0), (-1, -1), 1, COLORS['border']),
        ]))

        elements.append(header_table)
        elements.append(Spacer(1, 15*mm))

        return elements

    def _build_recipient(self, mottaker: BrevPart) -> list:
        """Build the recipient section."""
        elements = []

        elements.append(Paragraph("TIL", self.styles['RecipientLabel']))
        elements.append(Paragraph(mottaker.navn, self.styles['RecipientName']))

        if mottaker.adresse:
            elements.append(Paragraph(mottaker.adresse, self.styles['RecipientDetail']))

        if mottaker.orgnr:
            elements.append(Paragraph(f"Org.nr: {mottaker.orgnr}", self.styles['RecipientDetail']))

        elements.append(Spacer(1, 15*mm))

        return elements

    def _draw_footer(self, canvas, doc, brev_innhold: BrevInnhold):
        """Draw footer on each page."""
        canvas.saveState()

        # Footer position
        footer_y = 25

        # Draw line above footer
        canvas.setStrokeColor(COLORS['border'])
        canvas.setLineWidth(1)
        canvas.line(50, footer_y + 15, A4[0] - 50, footer_y + 15)

        # Footer text
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(COLORS['text_muted'])

        # Left side
        left_text = f"{brev_innhold.referanser.sak_id} | NS 8407:2011"
        canvas.drawString(50, footer_y, left_text)

        # Right side
        right_text = f"Generert: {_get_norwegian_date()}"
        canvas.drawRightString(A4[0] - 50, footer_y, right_text)

        canvas.restoreState()


# Singleton instance
_generator: Optional[LetterPdfGenerator] = None


def get_letter_pdf_generator() -> LetterPdfGenerator:
    """Get or create the letter PDF generator instance."""
    global _generator
    if _generator is None:
        _generator = LetterPdfGenerator()
    return _generator
