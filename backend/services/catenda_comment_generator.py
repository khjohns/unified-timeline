"""
Catenda Comment Generator - Intelligent status comments with emoji mapping.

Generates context-aware comments for Catenda based on case state and events.
"""
from typing import Optional
from models.sak_state import SakState
from models.events import AnyEvent
from utils.logger import get_logger

logger = get_logger(__name__)


class CatendaCommentGenerator:
    """
    Generate intelligent status comments for Catenda with emoji mapping.

    Provides dynamic "next step" logic based on case state.
    """

    # Emoji mapping for different event types and statuses
    EMOJI_MAP = {
        # Event types
        'sak_opprettet': '🆕',
        'grunnlag_opprettet': '📋',
        'grunnlag_oppdatert': '✏️',
        'grunnlag_trukket': '↩️',
        'vederlag_krav_sendt': '💰',
        'vederlag_krav_oppdatert': '💵',
        'vederlag_krav_trukket': '↩️',
        'frist_krav_sendt': '⏰',
        'frist_krav_oppdatert': '⏱️',
        'frist_krav_trukket': '↩️',
        'respons_grunnlag': '✅',
        'respons_vederlag': '✅',
        'respons_frist': '✅',
        'eo_utstedt': '🎉',

        # Statuses
        'godkjent': '✅',
        'delvis_godkjent': '⚠️',
        'avslatt': '❌',
        'under_forhandling': '💬',
        'sendt': '📤',
        'utkast': '📝',
    }

    def generate_comment(
        self,
        state: SakState,
        event: AnyEvent,
        magic_link: Optional[str] = None
    ) -> str:
        """
        Generate intelligent comment text based on state and event.

        Args:
            state: Current case state after event
            event: The event that triggered this comment
            magic_link: Optional magic link URL for quick access

        Returns:
            Formatted comment text with markdown
        """
        try:
            emoji = self.EMOJI_MAP.get(event.event_type.value, '📌')
            event_type_display = self._format_event_type(event.event_type.value)

            # Build comment parts
            parts = []

            # Header with emoji
            parts.append(f"{emoji} **{event_type_display}**")
            parts.append("")  # Empty line

            # Status summary
            parts.append(self._build_status_summary(state))
            parts.append("")  # Empty line

            # Next steps
            next_step = self._build_next_step(state)
            if next_step:
                parts.append(next_step)
                parts.append("")  # Empty line

            # Magic link
            if magic_link:
                parts.append(f"🔗 [Åpne sak i KOE-systemet]({magic_link})")
                parts.append("")  # Empty line

            # Footer
            parts.append(f"_Oppdatert: {event.tidsstempel.strftime('%Y-%m-%d %H:%M')}_")

            return "\n".join(parts)

        except Exception as e:
            logger.error(f"Failed to generate comment: {e}")
            # Fallback to simple comment
            return f"📌 Sak oppdatert: {state.sak_id}"

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
        status_emoji = self.EMOJI_MAP.get(state.overordnet_status.lower(), '📊')
        lines.append(f"- Overordnet: {status_emoji} {state.overordnet_status}")

        # Track statuses
        tracks = [
            ('Grunnlag', state.grunnlag.status, state.grunnlag),
            ('Vederlag', state.vederlag.status, state.vederlag),
            ('Frist', state.frist.status, state.frist),
        ]

        for track_name, status, track in tracks:
            if status != 'ikke_relevant':
                track_emoji = self.EMOJI_MAP.get(status, '📌')
                status_display = self._format_status(status)
                lines.append(f"- {track_name}: {track_emoji} {status_display}")

                # Add details if available
                if track_name == 'Vederlag':
                    krevd_belop = getattr(track, 'belop_direkte', None) or getattr(track, 'kostnads_overslag', None)
                    if krevd_belop:
                        lines.append(f"  - Krevd: {krevd_belop:,.0f} NOK")
                    if track.godkjent_belop is not None:
                        lines.append(f"  - Godkjent: {track.godkjent_belop:,.0f} NOK")

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
            emoji = '👷'
        elif rolle == 'BH':
            emoji = '🏢'
        else:
            emoji = '👤'

        return f"**Neste steg:** {emoji} {handling}"

    def _format_status(self, status: str) -> str:
        """Format status for display."""
        status_map = {
            'ikke_relevant': 'Ikke relevant',
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
        return status_map.get(status, status.replace('_', ' ').title())
