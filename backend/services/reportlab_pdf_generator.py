"""
ReportLab PDF Generator for KOE case documents.

Pure Python solution - no native dependencies required.
Generates PDF showing current state and last events per track.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

from models.sak_state import SakState
from utils.logger import get_logger

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
        'sendt': 'Sendt',
        'under_behandling': 'Under behandling',
        'godkjent': 'Godkjent',
        'delvis_godkjent': 'Delvis godkjent',
        'avslatt': 'Avslått',
        'under_forhandling': 'Under forhandling',
        'trukket': 'Trukket',
        'laast': 'Låst',
    }

    # BH resultat mappings
    GRUNNLAG_RESULTAT_MAP = {
        'godkjent': 'Godkjent',
        'delvis_godkjent': 'Delvis godkjent',
        'erkjenn_fm': 'Erkjent Force Majeure',
        'avslatt': 'Avslått',
        'frafalt': 'Frafalt pålegg',
        'krever_avklaring': 'Krever avklaring',
    }

    VEDERLAG_RESULTAT_MAP = {
        'godkjent': 'Godkjent',
        'delvis_godkjent': 'Delvis godkjent',
        'avslatt': 'Avslått',
        'hold_tilbake': 'Hold tilbake betaling',
    }

    FRIST_RESULTAT_MAP = {
        'godkjent': 'Godkjent',
        'delvis_godkjent': 'Delvis godkjent',
        'avslatt': 'Avslått',
    }

    FRIST_VARSEL_TYPE_MAP = {
        'noytralt': 'Nøytralt varsel',
        'spesifisert': 'Spesifisert krav',
        'begge': 'Begge (nøytralt + spesifisert)',
        'force_majeure': 'Force majeure',
    }

    def __init__(self):
        """Initialize PDF generator with styles."""
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Setup custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='KoeTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            spaceAfter=12,
            textColor=colors.HexColor('#003366'),
        ))
        self.styles.add(ParagraphStyle(
            name='KoeSectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceBefore=16,
            spaceAfter=8,
            textColor=colors.HexColor('#005A9C'),
        ))
        self.styles.add(ParagraphStyle(
            name='KoeSubHeader',
            parent=self.styles['Heading3'],
            fontSize=11,
            spaceBefore=8,
            spaceAfter=4,
            textColor=colors.HexColor('#333333'),
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
            textColor=colors.HexColor('#666666'),
        ))

    def generate_pdf(
        self,
        state: SakState,
        events: Optional[List[Dict[str, Any]]] = None,
        output_path: Optional[str] = None
    ) -> Optional[bytes]:
        """
        Generate PDF from case state.

        Args:
            state: Current SakState
            events: Optional list of events for history
            output_path: If provided, save to file. Otherwise return bytes.

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
            story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#003366')))
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

            # Footer
            story.append(Spacer(1, 24))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CCCCCC')))
            story.append(Paragraph(
                f"Generert: {datetime.now().strftime('%Y-%m-%d %H:%M')} | Sak-ID: {state.sak_id}",
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
            f"1. Ansvarsgrunnlag <font size='9' color='#666666'>[{self._format_status(state.grunnlag.status)}]</font>",
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
            beskr = grunnlag.beskrivelse[:150] + '...' if len(grunnlag.beskrivelse or '') > 150 else grunnlag.beskrivelse
            te_data.append(['Beskrivelse:', beskr])

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
                begr = grunnlag.bh_begrunnelse[:150] + '...' if len(grunnlag.bh_begrunnelse or '') > 150 else grunnlag.bh_begrunnelse
                bh_data.append(['Begrunnelse:', begr])

            table = Table(bh_data, colWidths=[3.5*cm, 12.5*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        return elements

    def _build_vederlag_section(self, state: SakState, events: Optional[List] = None) -> List:
        """Build vederlag (compensation) section with TE/BH structure."""
        elements = []
        elements.append(Paragraph(
            f"2. Vederlagsjustering <font size='9' color='#666666'>[{self._format_status(state.vederlag.status)}]</font>",
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
            te_data.append(['Beløp:', f"{krevd:,.0f} kr"])

        if vederlag.begrunnelse:
            begr = vederlag.begrunnelse[:150] + '...' if len(vederlag.begrunnelse or '') > 150 else vederlag.begrunnelse
            te_data.append(['Begrunnelse:', begr])

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
                bh_data.append(['Godkjent beløp:', f"{vederlag.godkjent_belop:,.0f} kr"])

            if vederlag.bh_begrunnelse:
                begr = vederlag.bh_begrunnelse[:150] + '...' if len(vederlag.bh_begrunnelse or '') > 150 else vederlag.bh_begrunnelse
                bh_data.append(['Begrunnelse:', begr])

            table = Table(bh_data, colWidths=[3.5*cm, 12.5*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(table)

        return elements

    def _build_frist_section(self, state: SakState, events: Optional[List] = None) -> List:
        """Build frist (deadline extension) section with TE/BH structure."""
        elements = []
        elements.append(Paragraph(
            f"3. Fristforlengelse <font size='9' color='#666666'>[{self._format_status(state.frist.status)}]</font>",
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
            begr = frist.begrunnelse[:150] + '...' if len(frist.begrunnelse or '') > 150 else frist.begrunnelse
            te_data.append(['Begrunnelse:', begr])

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
                begr = frist.bh_begrunnelse[:150] + '...' if len(frist.bh_begrunnelse or '') > 150 else frist.bh_begrunnelse
                bh_data.append(['Begrunnelse:', begr])

            table = Table(bh_data, colWidths=[3.5*cm, 12.5*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
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
        elements.append(Paragraph("1. Beregningsgrunnlag (30%-regelen)", self.styles['KoeSectionHeader']))

        calc_data = [
            ['Avslåtte dager:', f"{fd.avslatte_dager} dager"],
            ['Dagmulktsats:', f"{fd.dagmulktsats:,.0f} kr/dag"],
            ['Dagmulktgrunnlag:', f"{fd.avslatte_dager * fd.dagmulktsats:,.0f} kr"],
            ['+ 30% tillegg:', f"{fd.avslatte_dager * fd.dagmulktsats * 0.3:,.0f} kr"],
            ['= Maks forsering:', f"{fd.maks_forseringskostnad:,.0f} kr"],
        ]

        table = Table(calc_data, colWidths=[4*cm, 12*cm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LINEBELOW', (-1, -2), (-1, -2), 0.5, colors.HexColor('#CCCCCC')),
        ]))
        elements.append(table)

        # 2. TE varsel
        elements.append(Paragraph("2. Entreprenør varsler forsering", self.styles['KoeSectionHeader']))
        elements.append(Paragraph("<b>ENTREPRENØR KREVER:</b>", self.styles['KoeSubHeader']))

        te_data = [
            ['Dato varslet:', fd.dato_varslet],
            ['Estimert kostnad:', f"{fd.estimert_kostnad:,.0f} kr"],
            ['Innenfor grense:', 'Ja' if fd.kostnad_innenfor_grense else 'Nei'],
        ]

        if fd.avslatte_fristkrav:
            te_data.append(['Relaterte saker:', ', '.join(fd.avslatte_fristkrav)])

        table = Table(te_data, colWidths=[4*cm, 12*cm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
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
                bh_data.append(['Godkjent kostnad:', f"{fd.bh_godkjent_kostnad:,.0f} kr"])
            if fd.bh_begrunnelse:
                begr = fd.bh_begrunnelse[:150] + '...' if len(fd.bh_begrunnelse) > 150 else fd.bh_begrunnelse
                bh_data.append(['Begrunnelse:', begr])

            table = Table(bh_data, colWidths=[4*cm, 12*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
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
        elements.append(Paragraph(f"1. Endringsordre {eo.eo_nummer}", self.styles['KoeSectionHeader']))
        elements.append(Paragraph("<b>BYGGHERRE UTSTEDER:</b>", self.styles['KoeSubHeader']))

        bh_data = [
            ['EO-nummer:', eo.eo_nummer],
            ['Revisjon:', str(eo.revisjon_nummer)],
        ]

        if eo.dato_utstedt:
            bh_data.append(['Dato utstedt:', eo.dato_utstedt])

        if eo.beskrivelse:
            beskr = eo.beskrivelse[:150] + '...' if len(eo.beskrivelse) > 150 else eo.beskrivelse
            bh_data.append(['Beskrivelse:', beskr])

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
            bh_data.append(['Kompensasjon:', f"{eo.kompensasjon_belop:,.0f} kr"])

        if eo.frist_dager is not None:
            bh_data.append(['Fristforlengelse:', f"{eo.frist_dager} dager"])

        if eo.oppgjorsform:
            oppgjor_labels = {
                'ENHETSPRISER': 'Enhetspriser',
                'REGNINGSARBEID': 'Regningsarbeid',
                'FASTPRIS_TILBUD': 'Fastpris tilbud'
            }
            bh_data.append(['Oppgjørsform:', oppgjor_labels.get(eo.oppgjorsform, eo.oppgjorsform)])

        if eo.relaterte_koe_saker:
            bh_data.append(['Relaterte KOE:', ', '.join(eo.relaterte_koe_saker)])

        table = Table(bh_data, colWidths=[4*cm, 12*cm])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
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
                te_data.append(['Dato respons:', eo.dato_te_respons])

            if eo.te_kommentar:
                komm = eo.te_kommentar[:150] + '...' if len(eo.te_kommentar) > 150 else eo.te_kommentar
                te_data.append(['Kommentar:', komm])

            table = Table(te_data, colWidths=[4*cm, 12*cm])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#555555')),
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


def generate_koe_pdf(state: SakState, events: Optional[List] = None, output_path: Optional[str] = None) -> Optional[bytes]:
    """
    Convenience function to generate KOE PDF.

    Args:
        state: Current SakState
        events: Optional list of events
        output_path: If provided, save to file

    Returns:
        PDF bytes if output_path is None
    """
    generator = ReportLabPdfGenerator()
    return generator.generate_pdf(state, events, output_path)
