"""
WeasyPrint PDF generator for KOE case forms.

Uses HTML/CSS for layout (easier to maintain than reportlab).
Can reuse CSS styling from frontend.
"""
from typing import Optional
from pathlib import Path
from datetime import datetime
from weasyprint import HTML
from jinja2 import Template

from models.sak_state import SakState
from utils.logger import get_logger

logger = get_logger(__name__)


class WeasyPrintGenerator:
    """
    Generate PDF documents from KOE case state using WeasyPrint.

    Advantages over reportlab:
    - HTML/CSS layout (familiar to web developers)
    - Can reuse frontend CSS
    - Better typography
    - Easier maintenance
    """

    # HTML template for KOE PDF
    TEMPLATE = '''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page {
                size: A4;
                margin: 2cm;
            }

            body {
                font-family: Arial, sans-serif;
                font-size: 10pt;
                color: #333;
            }

            .header {
                color: #003366;
                font-size: 18pt;
                font-weight: bold;
                margin-bottom: 20px;
                border-bottom: 2px solid #003366;
                padding-bottom: 10px;
            }

            .metadata {
                margin-bottom: 30px;
                background-color: #f5f5f5;
                padding: 15px;
                border-radius: 4px;
            }

            .metadata-row {
                margin-bottom: 8px;
            }

            .label {
                font-weight: bold;
                color: #555;
                display: inline-block;
                width: 150px;
            }

            .section {
                margin-top: 30px;
                page-break-inside: avoid;
            }

            .section-header {
                color: #005A9C;
                font-size: 14pt;
                font-weight: bold;
                margin-bottom: 15px;
                border-bottom: 1px solid #005A9C;
                padding-bottom: 5px;
            }

            .field-group {
                margin-bottom: 15px;
                padding: 10px;
                background-color: #fafafa;
                border-left: 3px solid #005A9C;
            }

            .field-label {
                font-weight: bold;
                color: #555;
                margin-bottom: 5px;
            }

            .field-value {
                color: #333;
                margin-left: 10px;
            }

            .status-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 9pt;
                font-weight: bold;
            }

            .status-godkjent {
                background-color: #d4edda;
                color: #155724;
            }

            .status-sendt {
                background-color: #d1ecf1;
                color: #0c5460;
            }

            .status-avvist {
                background-color: #f8d7da;
                color: #721c24;
            }

            .status-delvis {
                background-color: #fff3cd;
                color: #856404;
            }

            .not-relevant {
                color: #999;
                font-style: italic;
            }

            .footer {
                margin-top: 50px;
                padding-top: 15px;
                border-top: 1px solid #ccc;
                font-size: 8pt;
                color: #666;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="header">
            Krav om Endringsordre (KOE)
        </div>

        <div class="metadata">
            <div class="metadata-row">
                <span class="label">Sakstittel:</span>
                <span>{{ state.sakstittel }}</span>
            </div>
            <div class="metadata-row">
                <span class="label">Sak-ID:</span>
                <span>{{ state.sak_id }}</span>
            </div>
            <div class="metadata-row">
                <span class="label">Dato generert:</span>
                <span>{{ now }}</span>
            </div>
            <div class="metadata-row">
                <span class="label">Overordnet status:</span>
                <span class="status-badge status-{{ state.overordnet_status|lower|replace(' ', '-') }}">
                    {{ state.overordnet_status }}
                </span>
            </div>
        </div>

        <!-- GRUNNLAG SECTION -->
        <div class="section">
            <div class="section-header">1. GRUNNLAG</div>
            {% if state.grunnlag.status != 'ikke_relevant' %}
                <div class="field-group">
                    <div class="field-label">Status:</div>
                    <div class="field-value">
                        <span class="status-badge status-{{ state.grunnlag.status|lower|replace('_', '-') }}">
                            {{ format_status(state.grunnlag.status) }}
                        </span>
                    </div>
                </div>
                {% if state.grunnlag.hovedkategori %}
                <div class="field-group">
                    <div class="field-label">Hovedkategori:</div>
                    <div class="field-value">{{ state.grunnlag.hovedkategori }}</div>
                </div>
                {% endif %}
                {% if state.grunnlag.underkategori %}
                <div class="field-group">
                    <div class="field-label">Underkategori:</div>
                    <div class="field-value">{{ state.grunnlag.underkategori }}</div>
                </div>
                {% endif %}
                {% if state.grunnlag.beskrivelse %}
                <div class="field-group">
                    <div class="field-label">Beskrivelse:</div>
                    <div class="field-value">{{ state.grunnlag.beskrivelse }}</div>
                </div>
                {% endif %}
                {% if state.grunnlag.dato_oppdaget %}
                <div class="field-group">
                    <div class="field-label">Dato oppdaget:</div>
                    <div class="field-value">{{ state.grunnlag.dato_oppdaget }}</div>
                </div>
                {% endif %}
                {% if state.grunnlag.bh_resultat %}
                <div class="field-group">
                    <div class="field-label">BH Resultat:</div>
                    <div class="field-value">{{ format_status(state.grunnlag.bh_resultat) }}</div>
                </div>
                {% endif %}
                {% if state.grunnlag.bh_begrunnelse %}
                <div class="field-group">
                    <div class="field-label">BH Begrunnelse:</div>
                    <div class="field-value">{{ state.grunnlag.bh_begrunnelse }}</div>
                </div>
                {% endif %}
            {% else %}
                <div class="not-relevant">Ikke relevant</div>
            {% endif %}
        </div>

        <!-- VEDERLAG SECTION -->
        <div class="section">
            <div class="section-header">2. VEDERLAG</div>
            {% if state.vederlag.status != 'ikke_relevant' %}
                <div class="field-group">
                    <div class="field-label">Status:</div>
                    <div class="field-value">
                        <span class="status-badge status-{{ state.vederlag.status|lower|replace('_', '-') }}">
                            {{ format_status(state.vederlag.status) }}
                        </span>
                    </div>
                </div>
                {% if state.vederlag.krevd_belop is not none %}
                <div class="field-group">
                    <div class="field-label">Krevd beløp:</div>
                    <div class="field-value">{{ '{:,}'.format(state.vederlag.krevd_belop) }} NOK</div>
                </div>
                {% endif %}
                {% if state.vederlag.metode %}
                <div class="field-group">
                    <div class="field-label">Metode:</div>
                    <div class="field-value">{{ state.vederlag.metode }}</div>
                </div>
                {% endif %}
                {% if state.vederlag.begrunnelse %}
                <div class="field-group">
                    <div class="field-label">Begrunnelse:</div>
                    <div class="field-value">{{ state.vederlag.begrunnelse }}</div>
                </div>
                {% endif %}
                {% if state.vederlag.bh_resultat %}
                <div class="field-group">
                    <div class="field-label">BH Resultat:</div>
                    <div class="field-value">{{ format_status(state.vederlag.bh_resultat) }}</div>
                </div>
                {% endif %}
                {% if state.vederlag.godkjent_belop is not none %}
                <div class="field-group">
                    <div class="field-label">Godkjent beløp:</div>
                    <div class="field-value">{{ '{:,}'.format(state.vederlag.godkjent_belop) }} NOK</div>
                </div>
                {% endif %}
                {% if state.vederlag.bh_begrunnelse %}
                <div class="field-group">
                    <div class="field-label">BH Begrunnelse:</div>
                    <div class="field-value">{{ state.vederlag.bh_begrunnelse }}</div>
                </div>
                {% endif %}
            {% else %}
                <div class="not-relevant">Ikke relevant</div>
            {% endif %}
        </div>

        <!-- FRIST SECTION -->
        <div class="section">
            <div class="section-header">3. FRISTFORLENGELSE</div>
            {% if state.frist.status != 'ikke_relevant' %}
                <div class="field-group">
                    <div class="field-label">Status:</div>
                    <div class="field-value">
                        <span class="status-badge status-{{ state.frist.status|lower|replace('_', '-') }}">
                            {{ format_status(state.frist.status) }}
                        </span>
                    </div>
                </div>
                {% if state.frist.krevd_dager is not none %}
                <div class="field-group">
                    <div class="field-label">Antall dager:</div>
                    <div class="field-value">{{ state.frist.krevd_dager }}</div>
                </div>
                {% endif %}
                {% if state.frist.frist_type %}
                <div class="field-group">
                    <div class="field-label">Type:</div>
                    <div class="field-value">{{ state.frist.frist_type }}</div>
                </div>
                {% endif %}
                {% if state.frist.begrunnelse %}
                <div class="field-group">
                    <div class="field-label">Begrunnelse:</div>
                    <div class="field-value">{{ state.frist.begrunnelse }}</div>
                </div>
                {% endif %}
                {% if state.frist.bh_resultat %}
                <div class="field-group">
                    <div class="field-label">BH Resultat:</div>
                    <div class="field-value">{{ format_status(state.frist.bh_resultat) }}</div>
                </div>
                {% endif %}
                {% if state.frist.godkjent_dager is not none %}
                <div class="field-group">
                    <div class="field-label">Godkjente dager:</div>
                    <div class="field-value">{{ state.frist.godkjent_dager }}</div>
                </div>
                {% endif %}
                {% if state.frist.bh_begrunnelse %}
                <div class="field-group">
                    <div class="field-label">BH Begrunnelse:</div>
                    <div class="field-value">{{ state.frist.bh_begrunnelse }}</div>
                </div>
                {% endif %}
            {% else %}
                <div class="not-relevant">Ikke relevant</div>
            {% endif %}
        </div>

        <div class="footer">
            Generert av KOE Automation System • {{ now }}
        </div>
    </body>
    </html>
    '''

    def __init__(self):
        """Initialize WeasyPrint generator."""
        self.template = Template(self.TEMPLATE)

    def generate_koe_pdf(
        self,
        state: SakState,
        output_path: str
    ) -> bool:
        """
        Generate PDF from case state using HTML/CSS.

        Args:
            state: Current SakState
            output_path: File path for output PDF

        Returns:
            True if successful, False otherwise
        """
        try:
            # Render HTML from template
            html_content = self.template.render(
                state=state,
                now=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                format_status=self._format_status
            )

            # Generate PDF with WeasyPrint
            HTML(string=html_content).write_pdf(output_path)

            logger.info(f"✅ PDF generated with WeasyPrint: {output_path}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to generate PDF with WeasyPrint: {e}")
            return False

    def _format_status(self, status: str) -> str:
        """Format status string for display."""
        status_map = {
            'IKKE_RELEVANT': 'Ikke relevant',
            'UTKAST': 'Utkast',
            'SENDT': 'Sendt til BH',
            'GODKJENT': 'Godkjent',
            'DELVIS_GODKJENT': 'Delvis godkjent',
            'AVVIST_UENIG': 'Avvist (uenig)',
            'AVVIST_FOR_SENT': 'Avvist (for sent)',
            'LAAST': 'Låst',
            'ikke_relevant': 'Ikke relevant',
            'utkast': 'Utkast',
            'sendt': 'Sendt til BH',
            'under_behandling': 'Under behandling',
            'godkjent': 'Godkjent',
            'delvis_godkjent': 'Delvis godkjent',
            'avvist': 'Avvist',
            'under_forhandling': 'Under forhandling',
            'trukket': 'Trukket',
            'laast': 'Låst',
            'godkjent': 'Godkjent',
            'avvist_uenig': 'Avvist (uenig)',
            'avvist_for_sent': 'Avvist (for sent)',
            'krever_avklaring': 'Krever avklaring',
        }
        return status_map.get(status, status)
