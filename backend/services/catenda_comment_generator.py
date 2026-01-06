"""
Catenda Comment Generator - Clean status comments with minimal formatting.

Generates context-aware comments for Catenda based on case state and events.
"""
from typing import Optional
from models.sak_state import SakState
from models.events import AnyEvent
from utils.logger import get_logger

logger = get_logger(__name__)


class CatendaCommentGenerator:
    """
    Generate clean status comments for Catenda.

    Uses text formatting (bold, italic) instead of emojis.
    Provides dynamic "next step" logic based on case state.
    """

    def generate_comment(
        self,
        state: SakState,
        event: AnyEvent,
        magic_link: Optional[str] = None
    ) -> str:
        """
        Generate comment text based on state and event.

        Args:
            state: Current case state after event
            event: The event that triggered this comment
            magic_link: Optional magic link URL for quick access

        Returns:
            Formatted comment text with markdown
        """
        try:
            event_type_value = event.event_type.value
            event_type_display = self._format_event_type(event_type_value)

            # Build comment parts
            parts = []

            # Header
            parts.append(f"**{event_type_display}**")
            parts.append("")

            # Forsering-specific content
            if event_type_value.startswith('forsering_'):
                forsering_content = self._build_forsering_content(event)
                if forsering_content:
                    parts.append(forsering_content)
                    parts.append("")

            # Status summary
            parts.append(self._build_status_summary(state))
            parts.append("")

            # Next steps
            next_step = self._build_next_step(state)
            if next_step:
                parts.append(next_step)
                parts.append("")

            # Magic link
            if magic_link:
                parts.append(f"[Åpne sak i KOE-systemet]({magic_link})")
                parts.append("")

            # Footer
            parts.append(f"_Oppdatert: {event.tidsstempel.strftime('%Y-%m-%d %H:%M')}_")

            return "\n".join(parts)

        except Exception as e:
            logger.error(f"Failed to generate comment: {e}")
            return f"Sak oppdatert: {state.sak_id}"

    def _build_forsering_content(self, event: AnyEvent) -> Optional[str]:
        """Build forsering-specific content based on event type."""
        event_type = event.event_type.value

        if not hasattr(event, 'data'):
            return None

        data = event.data
        lines = []

        if event_type == 'forsering_respons':
            # BH-respons på forsering
            aksepterer = getattr(data, 'aksepterer', None)
            if aksepterer is not None:
                beslutning = "Akseptert" if aksepterer else "Avvist"
                lines.append(f"**Beslutning:** {beslutning}")

            godkjent_kostnad = getattr(data, 'godkjent_kostnad', None)
            if godkjent_kostnad is not None:
                lines.append(f"**Godkjent kostnad:** {godkjent_kostnad:,.0f} kr")

            begrunnelse = getattr(data, 'begrunnelse', None)
            if begrunnelse:
                lines.append(f"**Begrunnelse:** {begrunnelse}")

        elif event_type == 'forsering_stoppet':
            # Forsering stoppet
            begrunnelse = getattr(data, 'begrunnelse', None)
            if begrunnelse:
                lines.append(f"**Begrunnelse:** {begrunnelse}")

            paalopte_kostnader = getattr(data, 'paalopte_kostnader', None)
            if paalopte_kostnader is not None:
                lines.append(f"**Påløpte kostnader:** {paalopte_kostnader:,.0f} kr")

            dato_stoppet = getattr(data, 'dato_stoppet', None)
            if dato_stoppet:
                lines.append(f"**Dato stoppet:** {dato_stoppet}")

        elif event_type == 'forsering_kostnader_oppdatert':
            # Kostnader oppdatert
            paalopte_kostnader = getattr(data, 'paalopte_kostnader', None)
            if paalopte_kostnader is not None:
                lines.append(f"**Påløpte kostnader:** {paalopte_kostnader:,.0f} kr")

            kommentar = getattr(data, 'kommentar', None)
            if kommentar:
                lines.append(f"**Kommentar:** {kommentar}")

        elif event_type == 'forsering_koe_lagt_til':
            # KOE lagt til
            koe_sak_id = getattr(data, 'koe_sak_id', None)
            koe_tittel = getattr(data, 'koe_tittel', None)
            if koe_sak_id:
                display = koe_tittel if koe_tittel else koe_sak_id
                lines.append(f"**KOE:** {display}")

        elif event_type == 'forsering_koe_fjernet':
            # KOE fjernet
            koe_sak_id = getattr(data, 'koe_sak_id', None)
            koe_tittel = getattr(data, 'koe_tittel', None)
            if koe_sak_id:
                display = koe_tittel if koe_tittel else koe_sak_id
                lines.append(f"**KOE fjernet:** {display}")

        return "\n".join(lines) if lines else None

    def _format_event_type(self, event_type: str) -> str:
        """Format event type for display."""
        event_type_map = {
            'sak_opprettet': 'Sak opprettet',
            'grunnlag_opprettet': 'Grunnlag opprettet',
            'grunnlag_oppdatert': 'Grunnlag oppdatert',
            'grunnlag_trukket': 'Grunnlag trukket',
            'vederlag_krav_sendt': 'Vederlagskrav sendt',
            'vederlag_krav_oppdatert': 'Vederlagskrav oppdatert',
            'vederlag_krav_trukket': 'Vederlagskrav trukket',
            'frist_krav_sendt': 'Fristkrav sendt',
            'frist_krav_oppdatert': 'Fristkrav oppdatert',
            'frist_krav_trukket': 'Fristkrav trukket',
            'respons_grunnlag': 'Respons på grunnlag',
            'respons_vederlag': 'Respons på vederlag',
            'respons_frist': 'Respons på frist',
            'eo_utstedt': 'Endringsordre utstedt',
            # Forsering events (§33.8)
            'forsering_varsel': 'Forseringsvarsel',
            'forsering_respons': 'BH-respons på forsering',
            'forsering_stoppet': 'Forsering stoppet',
            'forsering_kostnader_oppdatert': 'Forseringskostnader oppdatert',
            'forsering_koe_lagt_til': 'KOE lagt til forseringssak',
            'forsering_koe_fjernet': 'KOE fjernet fra forseringssak',
        }
        return event_type_map.get(event_type, event_type.replace('_', ' ').title())

    def _build_status_summary(self, state: SakState) -> str:
        """Build status summary section."""
        lines = []
        lines.append("**Status:**")

        # Overordnet status
        overordnet_display = self._format_overordnet_status(state.overordnet_status)
        lines.append(f"- Overordnet: {overordnet_display}")

        # Track statuses
        tracks = [
            ('Grunnlag', state.grunnlag.status, state.grunnlag),
            ('Vederlag', state.vederlag.status, state.vederlag),
            ('Frist', state.frist.status, state.frist),
        ]

        for track_name, status, track in tracks:
            if status != 'ikke_relevant':
                status_display = self._format_status(status)
                lines.append(f"- {track_name}: {status_display}")

                # Add details if available
                if track_name == 'Vederlag':
                    krevd_belop = getattr(track, 'belop_direkte', None) or getattr(track, 'kostnads_overslag', None)
                    if krevd_belop:
                        lines.append(f"  - Krevd: {krevd_belop:,.0f} kr")
                    if track.godkjent_belop is not None:
                        lines.append(f"  - Godkjent: {track.godkjent_belop:,.0f} kr")

                if track_name == 'Frist' and hasattr(track, 'krevd_dager') and track.krevd_dager:
                    lines.append(f"  - Krevd: {track.krevd_dager} dager")
                    if track.godkjent_dager is not None:
                        lines.append(f"  - Godkjent: {track.godkjent_dager} dager")

        return "\n".join(lines)

    def _build_next_step(self, state: SakState) -> Optional[str]:
        """Build next step section based on state."""
        next_action = state.neste_handling

        if not next_action or not next_action.get('rolle'):
            return None

        rolle = next_action['rolle']
        handling = next_action['handling']

        if rolle == 'TE':
            rolle_display = 'Entreprenør'
        elif rolle == 'BH':
            rolle_display = 'Byggherre'
        else:
            rolle_display = rolle

        return f"**Neste steg:** {rolle_display} - {handling}"

    def _format_overordnet_status(self, status: str) -> str:
        """Format overordnet status for display."""
        status_map = {
            'UNDER_VARSLING': 'Under varsling',
            'VENTER_PAA_SVAR': 'Venter på svar',
            'UNDER_FORHANDLING': 'Under forhandling',
            'OMFORENT': 'Omforent',
            'AVSLUTTET': 'Avsluttet',
            'LUKKET': 'Lukket',
        }
        return status_map.get(status, status.replace('_', ' ').title())

    def _format_status(self, status: str) -> str:
        """Format track status for display."""
        status_map = {
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
        return status_map.get(status, status.replace('_', ' ').title())
