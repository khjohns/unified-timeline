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
            event_type_display = self._format_event_type(event.event_type.value)

            # Build comment parts
            parts = []

            # Header
            parts.append(f"**{event_type_display}**")
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
