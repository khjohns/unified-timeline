"""
ReportLab PDF Generator for KOE case documents.

Pure Python solution - no native dependencies required.
Generates PDF showing current state and last events per track.
"""
import re
from typing import Optional, List, Dict, Any, TypedDict
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from io import BytesIO


def _get_norwegian_time() -> str:
    """Get current time in Norwegian timezone for display."""
    utc_now = datetime.now(timezone.utc)
    norwegian_tz = ZoneInfo("Europe/Oslo")
    local_time = utc_now.astimezone(norwegian_tz)
    return local_time.strftime('%Y-%m-%d %H:%M')

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable
)

from models.sak_state import SakState
from utils.logger import get_logger


class SignatureInfo(TypedDict):
    """Signature information for approved documents."""
    navn: str
    rolle: str
    dato: str

# Import label helpers
from constants.grunnlag_categories import (
    get_hovedkategori_label,
    get_underkategori_label,
    get_underkategori,
)
from constants.vederlag_methods import VEDERLAG_METODER

logger = get_logger(__name__)


class ReportLabPdfGenerator:
    """
    Generate PDF documents from KOE case state using ReportLab.

    Shows:
    - Case metadata and overall status
    - Three tracks: Grunnlag, Vederlag, Frist
    - Last event from TE and BH per track
    """

    # Oslo Kommune design colors
    COLORS = {
        'primary': '#2A2859',       # Oslo dark blue
        'secondary': '#1F42AA',     # Oslo warm blue
        'text': '#2C2C2C',          # Oslo ink
        'muted': '#666666',
        'border': '#E6E6E6',
        'gray_bg': '#F9F9F9',
        'success': '#034B45',
        'error': '#C9302C',
        'warning': '#F9C66B',
    }

    # Status display mapping
    STATUS_MAP = {
        'UNDER_VARSLING': 'Under varsling',
        'VENTER_PAA_SVAR': 'Venter på svar',
        'UNDER_FORHANDLING': 'Under forhandling',
        'OMFORENT': 'Omforent',
        'AVSLUTTET': 'Avsluttet',
        'LUKKET': 'Lukket',
        'ikke_relevant': 'Ikke relevant',
        'ikke_startet': 'Ikke startet',
        'utkast': 'Utkast',
        'sendt': 'Sendt til BH',
        'under_behandling': 'Under behandling',
        'godkjent': 'Godkjent',
        'delvis_godkjent': 'Delvis godkjent',
        'avslatt': 'Avslått',
        'under_forhandling': 'Under forhandling',
        'trukket': 'Trukket',
        'laast': 'Låst',
    }

    # BH resultat mappings - aligned with NS 8407 terminology
    GRUNNLAG_RESULTAT_MAP = {
        'godkjent': 'Godkjent',
        'delvis_godkjent': 'Delvis godkjent',
        'avslatt': 'Avslått',
        'frafalt': 'Frafalt (§32.3 c)',
    }

    VEDERLAG_RESULTAT_MAP = {
        'godkjent': 'Godkjent',
        'delvis_godkjent': 'Delvis godkjent',
        'avslatt': 'Avslått',
        'hold_tilbake': 'Betaling holdes tilbake (§30.2)',
    }

    FRIST_RESULTAT_MAP = {
        'godkjent': 'Godkjent',
        'delvis_godkjent': 'Delvis godkjent',
        'avslatt': 'Avslått',
    }

    # Frist varseltyper med NS 8407 §-referanser
    FRIST_VARSEL_TYPE_MAP = {
        'noytralt': 'Foreløpig varsel (§33.4)',
        'spesifisert': 'Spesifisert krav (§33.6)',
    }

    # Norwegian month names for date formatting
    NORWEGIAN_MONTHS = [
        'januar', 'februar', 'mars', 'april', 'mai', 'juni',
        'juli', 'august', 'september', 'oktober', 'november', 'desember'
    ]

    def __init__(self):
        """Initialize PDF generator with styles."""
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Setup custom paragraph styles using Oslo Kommune design colors."""
        self.styles.add(ParagraphStyle(
            name='KoeTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            spaceAfter=12,
            textColor=colors.HexColor(self.COLORS['primary']),
        ))
        self.styles.add(ParagraphStyle(
            name='KoeSectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceBefore=16,
            spaceAfter=8,
            textColor=colors.HexColor(self.COLORS['secondary']),
        ))
        self.styles.add(ParagraphStyle(
            name='KoeSubHeader',
            parent=self.styles['Heading3'],
            fontSize=11,
            spaceBefore=8,
            spaceAfter=4,
            textColor=colors.HexColor(self.COLORS['text']),
        ))
        self.styles.add(ParagraphStyle(
            name='KoeBodyText',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6,
        ))
        self.styles.add(ParagraphStyle(
            name='KoeSmallText',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor(self.COLORS['muted']),
        ))

    def _wrap_text(self, text: str, style_name: str = 'KoeBodyText') -> Paragraph:
        """Wrap text in a Paragraph with markdown formatting support."""
        if not text:
            return Paragraph('', self.styles[style_name])
        formatted = self._markdown_to_reportlab(text)
        return Paragraph(formatted, self.styles[style_name])

    def _markdown_to_reportlab(self, text: str) -> str:
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
        """
        lines = text.split('\n')
        result_lines = []

        for line in lines:
            # Escape XML special characters first (but preserve markdown)
            line = line.replace('&', '&amp;')

            # Headers: ### must come before ## which must come before #
            if line.startswith('### '):
                line = f'<font size="11"><b>{line[4:]}</b></font>'
            elif line.startswith('## '):
                line = f'<font size="12"><b>{line[3:]}</b></font>'
            elif line.startswith('# '):
                line = f'<font size="14"><b>{line[2:]}</b></font>'
            # Unordered lists: - item -> • item
            elif re.match(r'^[\t ]*[-*+] \S', line):
                line = re.sub(r'^[\t ]*([-*+]) ', '    • ', line)
            # Ordered lists: 1. item -> 1. item (with indent)
            elif re.match(r'^[\t ]*\d+\. \S', line):
                line = re.sub(r'^[\t ]*(\d+)\. ', r'    \1. ', line)

            # Links: [text](url) -> text (url)
            line = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 (\2)', line)

            # Bold: **text** -> <b>text</b>
            line = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', line)
            line = re.sub(r'__([^_]+)__', r'<b>\1</b>', line)

            # Italic: *text* -> <i>text</i>
            line = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', line)
            line = re.sub(r'(?<!_)_([^_]+)_(?!_)', r'<i>\1</i>', line)

            # Strikethrough: ~~text~~ -> <strike>text</strike>
            line = re.sub(r'~~([^~]+)~~', r'<strike>\1</strike>', line)

            # Inline code: `code` -> monospace font
            line = re.sub(r'`([^`]+)`', r'<font face="Courier" color="#C7254E">\1</font>', line)

            result_lines.append(line)

        return '<br/>'.join(result_lines)

    def _format_date_norwegian(self, date_str: str) -> str:
        """Format date string as '5. desember 2024'."""
        if not date_str:
            return ''
        try:
            # Handle ISO format (YYYY-MM-DD or with time)
            date_part = date_str[:10] if len(date_str) >= 10 else date_str
            parts = date_part.split('-')
            if len(parts) == 3:
                year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                month_name = self.NORWEGIAN_MONTHS[month - 1]
                return f"{day}. {month_name} {year}"
        except (ValueError, IndexError):
            pass
        return date_str

    def _format_currency(self, amount: float) -> str:
        """Format amount as '1 234 567 NOK'."""
        if amount is None:
            return ''
        return f"{amount:,.0f} NOK".replace(',', ' ')

    def generate_pdf(
        self,
        state: SakState,
        events: Optional[List[Dict[str, Any]]] = None,
        output_path: Optional[str] = None,
        saksbehandler: Optional[SignatureInfo] = None,
        godkjenner: Optional[SignatureInfo] = None,
    ) -> Optional[bytes]:
        """
        Generate PDF from case state.

        Args:
            state: Current SakState
            events: Optional list of events for history
            output_path: If provided, save to file. Otherwise return bytes.
            saksbehandler: Optional signature info for saksbehandler (only shown when both provided)
            godkjenner: Optional signature info for godkjenner (only shown when both provided)

        Returns:
            PDF bytes if output_path is None, else None (saves to file)
        """
        try:
            # Create buffer or file
            if output_path:
                doc = SimpleDocTemplate(
                    output_path,
                    pagesize=A4,
                    rightMargin=2*cm,
                    leftMargin=2*cm,
                    topMargin=2*cm,
                    bottomMargin=2*cm
                )
            else:
                buffer = BytesIO()
                doc = SimpleDocTemplate(
                    buffer,
                    pagesize=A4,
                    rightMargin=2*cm,
                    leftMargin=2*cm,
                    topMargin=2*cm,
                    bottomMargin=2*cm
                )

            # Build content
            story = []

            # Header - basert på sakstype
            sakstype = getattr(state, 'sakstype', 'koe')
            title_map = {
                'koe': 'Krav om Endringsordre (KOE)',
                'forsering': 'Forseringssak (§33.8)',
                'endringsordre': 'Endringsordre (§31.3)'
            }
            story.append(Paragraph(title_map.get(sakstype, 'Krav om Endringsordre'), self.styles['KoeTitle']))
            story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor(self.COLORS['primary'])))
            story.append(Spacer(1, 12))

            # Metadata table
            story.extend(self._build_metadata_section(state))

            # Innhold basert på sakstype
            if sakstype == 'forsering':
                story.extend(self._build_forsering_section(state))
            elif sakstype == 'endringsordre':
                story.extend(self._build_endringsordre_section(state))
            else:
                # Standard KOE - tre spor
                story.extend(self._build_grunnlag_section(state, events))
                story.extend(self._build_vederlag_section(state, events))
                story.extend(self._build_frist_section(state, events))

            # Signature section (only when both signatures provided)
            if saksbehandler and godkjenner:
                story.extend(self._build_signature_section(saksbehandler, godkjenner))

            # Footer
            story.append(Spacer(1, 24))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CCCCCC')))
            story.append(Paragraph(
                f"Generert: {_get_norwegian_time()} | Sak-ID: {state.sak_id}",
                self.styles['KoeSmallText']
            ))

            # Build PDF
            doc.build(story)

            if output_path:
                logger.info(f"PDF saved to {output_path}")
                return None
            else:
                pdf_bytes = buffer.getvalue()
                buffer.close()
                logger.info(f"PDF generated: {len(pdf_bytes)} bytes")
                return pdf_bytes

        except Exception as e:
            logger.error(f"Failed to generate PDF: {e}", exc_info=True)
            return None

    def _build_metadata_section(self, state: SakState) -> List:
        """Build metadata section."""
        elements = []

        # Metadata table
        data = [
            ['Sakstittel:', state.sakstittel or '(ikke satt)'],
            ['Sak-ID:', state.sak_id],
            ['Overordnet status:', self._format_status(state.overordnet_status)],
        ]

        table = Table(data, colWidths=[4*cm, 12*cm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 12))

        return elements

    def _build_grunnlag_section(self, state: SakState, events: Optional[List] = None) -> List:
        """Build grunnlag (basis) section with TE/BH structure."""
        elements = []
        elements.append(Paragraph(
            f"1. Ansvarsgrunnlag (§32) <font size='9' color='{self.COLORS['muted']}'>[{self._format_status(state.grunnlag.status)}]</font>",
            self.styles['KoeSectionHeader']
        ))

        grunnlag = state.grunnlag
        if grunnlag.status == 'ikke_relevant':
            elements.append(Paragraph("<i>Ikke relevant for denne saken</i>", self.styles['KoeBodyText']))
            return elements

        # TE section - Entreprenør krever
        elements.append(Paragraph("<b>ENTREPRENØR KREVER:</b>", self.styles['KoeSubHeader']))

        te_data = []
        if grunnlag.hovedkategori:
            hovedkat_label = get_hovedkategori_label(grunnlag.hovedkategori)
            te_data.append(['Hovedkategori:', hovedkat_label])

        if grunnlag.underkategori and grunnlag.hovedkategori:
            underkat_label = get_underkategori_label(grunnlag.hovedkategori, grunnlag.underkategori)
            te_data.append(['Underkategori:', underkat_label])

            # Get hjemmel reference
            underkat = get_underkategori(grunnlag.hovedkategori, grunnlag.underkategori)
            if underkat and underkat.get('hjemmel_basis'):
                te_data.append(['Hjemmel:', f"§{underkat['hjemmel_basis']}"])

        if grunnlag.beskrivelse:
            te_data.append(['Beskrivelse:', self._wrap_text(grunnlag.beskrivelse)])

        if te_data:
            table = Table(te_data, colWidths=[3.5*cm, 12.5*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        # BH section - Byggherre svarer (only if response exists)
        if grunnlag.bh_resultat:
            elements.append(Spacer(1, 8))
            elements.append(Paragraph("<b>BYGGHERRE SVARER:</b>", self.styles['KoeSubHeader']))

            bh_data = []
            resultat_label = self.GRUNNLAG_RESULTAT_MAP.get(grunnlag.bh_resultat, grunnlag.bh_resultat)
            bh_data.append(['Resultat:', resultat_label])

            if grunnlag.bh_begrunnelse:
                bh_data.append(['Begrunnelse:', self._wrap_text(grunnlag.bh_begrunnelse)])

            table = Table(bh_data, colWidths=[3.5*cm, 12.5*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(self.COLORS['muted'])),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        return elements

    def _build_vederlag_section(self, state: SakState, events: Optional[List] = None) -> List:
        """Build vederlag (compensation) section with TE/BH structure."""
        elements = []
        elements.append(Paragraph(
            f"2. Vederlagsjustering (§34) <font size='9' color='{self.COLORS['muted']}'>[{self._format_status(state.vederlag.status)}]</font>",
            self.styles['KoeSectionHeader']
        ))

        vederlag = state.vederlag
        if vederlag.status in ['ikke_relevant', 'ikke_startet']:
            elements.append(Paragraph(f"<i>{self._format_status(vederlag.status)}</i>", self.styles['KoeBodyText']))
            return elements

        # TE section - Entreprenør krever
        elements.append(Paragraph("<b>ENTREPRENØR KREVER:</b>", self.styles['KoeSubHeader']))

        te_data = []
        if vederlag.metode:
            metode_info = VEDERLAG_METODER.get(vederlag.metode)
            if metode_info:
                metode_label = f"{metode_info['label']} ({metode_info['paragraf']})"
            else:
                metode_label = vederlag.metode
            te_data.append(['Metode:', metode_label])

        krevd = vederlag.belop_direkte or vederlag.kostnads_overslag
        if krevd is not None:
            te_data.append(['Beløp:', self._format_currency(krevd)])

        if vederlag.begrunnelse:
            te_data.append(['Begrunnelse:', self._wrap_text(vederlag.begrunnelse)])

        if te_data:
            table = Table(te_data, colWidths=[3.5*cm, 12.5*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        # BH section - Byggherre svarer (only if response exists)
        if vederlag.bh_resultat:
            elements.append(Spacer(1, 8))
            elements.append(Paragraph("<b>BYGGHERRE SVARER:</b>", self.styles['KoeSubHeader']))

            bh_data = []
            resultat_label = self.VEDERLAG_RESULTAT_MAP.get(vederlag.bh_resultat, vederlag.bh_resultat)
            bh_data.append(['Resultat:', resultat_label])

            if vederlag.godkjent_belop is not None:
                bh_data.append(['Godkjent beløp:', self._format_currency(vederlag.godkjent_belop)])

            if vederlag.bh_begrunnelse:
                bh_data.append(['Begrunnelse:', self._wrap_text(vederlag.bh_begrunnelse)])

            table = Table(bh_data, colWidths=[3.5*cm, 12.5*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(self.COLORS['muted'])),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        return elements

    def _build_frist_section(self, state: SakState, events: Optional[List] = None) -> List:
        """Build frist (deadline extension) section with TE/BH structure."""
        elements = []
        elements.append(Paragraph(
            f"3. Fristforlengelse (§33) <font size='9' color='{self.COLORS['muted']}'>[{self._format_status(state.frist.status)}]</font>",
            self.styles['KoeSectionHeader']
        ))

        frist = state.frist
        if frist.status in ['ikke_relevant', 'ikke_startet']:
            elements.append(Paragraph(f"<i>{self._format_status(frist.status)}</i>", self.styles['KoeBodyText']))
            return elements

        # TE section - Entreprenør krever
        elements.append(Paragraph("<b>ENTREPRENØR KREVER:</b>", self.styles['KoeSubHeader']))

        te_data = []
        if hasattr(frist, 'varsel_type') and frist.varsel_type:
            varsel_label = self.FRIST_VARSEL_TYPE_MAP.get(frist.varsel_type, frist.varsel_type)
            te_data.append(['Varseltype:', varsel_label])

        if frist.krevd_dager is not None:
            te_data.append(['Antall dager:', f"{frist.krevd_dager} dager"])

        if frist.begrunnelse:
            te_data.append(['Begrunnelse:', self._wrap_text(frist.begrunnelse)])

        if te_data:
            table = Table(te_data, colWidths=[3.5*cm, 12.5*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        # BH section - Byggherre svarer (only if response exists)
        if frist.bh_resultat:
            elements.append(Spacer(1, 8))
            elements.append(Paragraph("<b>BYGGHERRE SVARER:</b>", self.styles['KoeSubHeader']))

            bh_data = []
            resultat_label = self.FRIST_RESULTAT_MAP.get(frist.bh_resultat, frist.bh_resultat)
            bh_data.append(['Resultat:', resultat_label])

            if frist.godkjent_dager is not None:
                bh_data.append(['Godkjent dager:', f"{frist.godkjent_dager} dager"])

            if frist.bh_begrunnelse:
                bh_data.append(['Begrunnelse:', self._wrap_text(frist.bh_begrunnelse)])

            table = Table(bh_data, colWidths=[3.5*cm, 12.5*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(self.COLORS['muted'])),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        return elements

    def _build_forsering_section(self, state: SakState) -> List:
        """Build forsering section for §33.8 cases."""
        elements = []

        fd = state.forsering_data
        if not fd:
            elements.append(Paragraph("<i>Ingen forseringsdata</i>", self.styles['KoeBodyText']))
            return elements

        # 1. Beregningsgrunnlag
        elements.append(Paragraph("1. Beregningsgrunnlag (30%-regelen, §33.8)", self.styles['KoeSectionHeader']))

        dagmulkt_grunnlag = fd.avslatte_dager * fd.dagmulktsats
        tillegg_30 = dagmulkt_grunnlag * 0.3
        calc_data = [
            ['Avslåtte dager:', f"{fd.avslatte_dager} dager"],
            ['Dagmulktsats:', self._format_currency(fd.dagmulktsats) + '/dag'],
            ['Dagmulktgrunnlag:', self._format_currency(dagmulkt_grunnlag)],
            ['+ 30% tillegg:', self._format_currency(tillegg_30)],
            ['= Maks forsering:', self._format_currency(fd.maks_forseringskostnad)],
        ]

        table = Table(calc_data, colWidths=[4*cm, 12*cm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(self.COLORS['muted'])),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LINEBELOW', (-1, -2), (-1, -2), 0.5, colors.HexColor(self.COLORS['border'])),
        ]))
        elements.append(table)

        # 2. TE varsel
        elements.append(Paragraph("2. Entreprenør varsler forsering", self.styles['KoeSectionHeader']))
        elements.append(Paragraph("<b>ENTREPRENØR KREVER:</b>", self.styles['KoeSubHeader']))

        te_data = [
            ['Dato varslet:', self._format_date_norwegian(fd.dato_varslet)],
            ['Estimert kostnad:', self._format_currency(fd.estimert_kostnad)],
            ['Innenfor grense:', 'Ja' if fd.kostnad_innenfor_grense else 'Nei'],
        ]

        if fd.avslatte_fristkrav:
            te_data.append(['Relaterte saker:', ', '.join(fd.avslatte_fristkrav)])

        table = Table(te_data, colWidths=[4*cm, 12*cm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(self.COLORS['muted'])),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(table)

        # 3. BH respons (hvis finnes)
        if fd.bh_aksepterer_forsering is not None:
            elements.append(Spacer(1, 8))
            elements.append(Paragraph("<b>BYGGHERRE SVARER:</b>", self.styles['KoeSubHeader']))

            bh_data = [
                ['Aksepterer:', 'Ja' if fd.bh_aksepterer_forsering else 'Nei'],
            ]
            if fd.bh_godkjent_kostnad is not None:
                bh_data.append(['Godkjent kostnad:', self._format_currency(fd.bh_godkjent_kostnad)])
            if fd.bh_begrunnelse:
                bh_data.append(['Begrunnelse:', self._wrap_text(fd.bh_begrunnelse)])

            table = Table(bh_data, colWidths=[4*cm, 12*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(self.COLORS['muted'])),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        return elements

    def _build_endringsordre_section(self, state: SakState) -> List:
        """Build endringsordre section for §31.3 cases."""
        elements = []

        eo = state.endringsordre_data
        if not eo:
            elements.append(Paragraph("<i>Ingen endringsordredata</i>", self.styles['KoeBodyText']))
            return elements

        # 1. EO-identifikasjon
        elements.append(Paragraph(f"1. Endringsordre {eo.eo_nummer} (§31.3)", self.styles['KoeSectionHeader']))
        elements.append(Paragraph("<b>BYGGHERRE UTSTEDER:</b>", self.styles['KoeSubHeader']))

        bh_data = [
            ['EO-nummer:', eo.eo_nummer],
            ['Revisjon:', str(eo.revisjon_nummer)],
        ]

        if eo.dato_utstedt:
            bh_data.append(['Dato utstedt:', self._format_date_norwegian(eo.dato_utstedt)])

        if eo.beskrivelse:
            bh_data.append(['Beskrivelse:', self._wrap_text(eo.beskrivelse)])

        # Konsekvenser
        konsekvenser = []
        if eo.konsekvenser.pris:
            konsekvenser.append('Pris')
        if eo.konsekvenser.fremdrift:
            konsekvenser.append('Fremdrift')
        if eo.konsekvenser.sha:
            konsekvenser.append('SHA')
        if eo.konsekvenser.kvalitet:
            konsekvenser.append('Kvalitet')
        if eo.konsekvenser.annet:
            konsekvenser.append('Annet')
        bh_data.append(['Konsekvenser:', ', '.join(konsekvenser) if konsekvenser else 'Ingen'])

        # Beløp
        if eo.kompensasjon_belop is not None:
            bh_data.append(['Kompensasjon:', self._format_currency(eo.kompensasjon_belop)])

        if eo.frist_dager is not None:
            bh_data.append(['Fristforlengelse:', f"{eo.frist_dager} dager"])

        if eo.oppgjorsform:
            oppgjor_labels = {
                'ENHETSPRISER': 'Enhetspriser (§34.3)',
                'REGNINGSARBEID': 'Regningsarbeid (§34.4)',
                'FASTPRIS_TILBUD': 'Avtalt vederlagsjustering (§34.2.1)'
            }
            bh_data.append(['Oppgjørsform:', oppgjor_labels.get(eo.oppgjorsform, eo.oppgjorsform)])

        if eo.relaterte_koe_saker:
            bh_data.append(['Relaterte KOE:', ', '.join(eo.relaterte_koe_saker)])

        table = Table(bh_data, colWidths=[4*cm, 12*cm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(self.COLORS['muted'])),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(table)

        # 2. TE-respons (hvis finnes)
        if eo.te_akseptert is not None:
            elements.append(Paragraph("2. Entreprenør svarer", self.styles['KoeSectionHeader']))
            elements.append(Paragraph("<b>ENTREPRENØR SVARER:</b>", self.styles['KoeSubHeader']))

            te_data = [
                ['Akseptert:', 'Ja' if eo.te_akseptert else 'Nei (bestridt)'],
            ]

            if eo.dato_te_respons:
                te_data.append(['Dato respons:', self._format_date_norwegian(eo.dato_te_respons)])

            if eo.te_kommentar:
                te_data.append(['Kommentar:', self._wrap_text(eo.te_kommentar)])

            table = Table(te_data, colWidths=[4*cm, 12*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(self.COLORS['muted'])),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        # Status-linje
        elements.append(Spacer(1, 12))
        status_label = self._format_status(eo.status.value if hasattr(eo.status, 'value') else str(eo.status))
        elements.append(Paragraph(
            f"<b>Status:</b> {status_label}",
            self.styles['KoeBodyText']
        ))

        return elements

    def _build_last_events(
        self,
        events: Optional[List],
        te_event_types: List[str],
        bh_event_types: List[str]
    ) -> List:
        """Build last events from TE and BH."""
        elements = []

        if not events:
            return elements

        # Find last TE event
        te_event = None
        for event in reversed(events):
            if event.get('event_type') in te_event_types:
                te_event = event
                break

        # Find last BH event
        bh_event = None
        for event in reversed(events):
            if event.get('event_type') in bh_event_types:
                bh_event = event
                break

        if te_event or bh_event:
            elements.append(Spacer(1, 8))
            elements.append(Paragraph("Siste hendelser:", self.styles['KoeSubHeader']))

            if te_event:
                date = te_event.get('tidsstempel', '')[:10] if te_event.get('tidsstempel') else ''
                event_type = self._format_event_type(te_event.get('event_type', ''))
                elements.append(Paragraph(
                    f"<b>Entreprenør ({date}):</b> {event_type}",
                    self.styles['KoeBodyText']
                ))

            if bh_event:
                date = bh_event.get('tidsstempel', '')[:10] if bh_event.get('tidsstempel') else ''
                event_type = self._format_event_type(bh_event.get('event_type', ''))
                resultat = bh_event.get('data', {}).get('resultat', '')
                if resultat:
                    resultat_display = self._format_status(resultat)
                    elements.append(Paragraph(
                        f"<b>Byggherre ({date}):</b> {event_type} - {resultat_display}",
                        self.styles['KoeBodyText']
                    ))
                else:
                    elements.append(Paragraph(
                        f"<b>Byggherre ({date}):</b> {event_type}",
                        self.styles['KoeBodyText']
                    ))

        return elements

    def _build_signature_section(
        self,
        saksbehandler: SignatureInfo,
        godkjenner: SignatureInfo
    ) -> List:
        """Build signature section for approved documents."""
        elements = []
        elements.append(Spacer(1, 30))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor(self.COLORS['border'])))
        elements.append(Spacer(1, 20))

        # Create two-column signature table
        # Each column contains label, name, role, date
        sig_data = [
            [
                Paragraph("<b>SAKSBEHANDLER</b>", self.styles['KoeSmallText']),
                Paragraph("<b>GODKJENNER</b>", self.styles['KoeSmallText']),
            ],
            [
                Paragraph(f"<b>{saksbehandler['navn']}</b>", self.styles['KoeBodyText']),
                Paragraph(f"<b>{godkjenner['navn']}</b>", self.styles['KoeBodyText']),
            ],
            [
                Paragraph(saksbehandler['rolle'], self.styles['KoeSmallText']),
                Paragraph(godkjenner['rolle'], self.styles['KoeSmallText']),
            ],
            [
                Paragraph(saksbehandler['dato'], self.styles['KoeSmallText']),
                Paragraph(godkjenner['dato'], self.styles['KoeSmallText']),
            ],
        ]

        sig_table = Table(sig_data, colWidths=[8*cm, 8*cm])
        sig_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, -1), (-1, -1), 12),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor(self.COLORS['gray_bg'])),
            ('BACKGROUND', (1, 0), (1, -1), colors.HexColor(self.COLORS['gray_bg'])),
            ('BOX', (0, 0), (0, -1), 1, colors.HexColor(self.COLORS['border'])),
            ('BOX', (1, 0), (1, -1), 1, colors.HexColor(self.COLORS['border'])),
        ]))
        elements.append(sig_table)

        return elements

    def _format_status(self, status: str) -> str:
        """Format status for display."""
        return self.STATUS_MAP.get(status, status.replace('_', ' ').title())

    def _format_event_type(self, event_type: str) -> str:
        """Format event type for display."""
        event_map = {
            'grunnlag_opprettet': 'Grunnlag opprettet',
            'grunnlag_oppdatert': 'Grunnlag oppdatert',
            'vederlag_krav_sendt': 'Vederlagskrav sendt',
            'vederlag_krav_oppdatert': 'Vederlagskrav oppdatert',
            'frist_krav_sendt': 'Fristkrav sendt',
            'frist_krav_oppdatert': 'Fristkrav oppdatert',
            'respons_grunnlag': 'Respons på grunnlag',
            'respons_vederlag': 'Respons på vederlag',
            'respons_frist': 'Respons på frist',
        }
        return event_map.get(event_type, event_type.replace('_', ' ').title())


def generate_koe_pdf(
    state: SakState,
    events: Optional[List] = None,
    output_path: Optional[str] = None,
    saksbehandler: Optional[SignatureInfo] = None,
    godkjenner: Optional[SignatureInfo] = None,
) -> Optional[bytes]:
    """
    Convenience function to generate KOE PDF.

    Args:
        state: Current SakState
        events: Optional list of events
        output_path: If provided, save to file
        saksbehandler: Optional signature info for saksbehandler
        godkjenner: Optional signature info for godkjenner

    Returns:
        PDF bytes if output_path is None
    """
    generator = ReportLabPdfGenerator()
    return generator.generate_pdf(state, events, output_path, saksbehandler, godkjenner)
