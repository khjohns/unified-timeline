"""
Business rule validation before event persistence.

All rules are validated BEFORE events are stored.
This ensures the event log never contains invalid state transitions.
"""
from dataclasses import dataclass
from typing import Optional, List, Tuple, Callable
from models.events import AnyEvent, EventType, SporStatus
from models.sak_state import SakState


@dataclass
class ValidationResult:
    """Result of business rule validation."""
    is_valid: bool
    message: Optional[str] = None
    violated_rule: Optional[str] = None


class BusinessRuleValidator:
    """
    Validates business rules before allowing events to be persisted.

    Rules are implemented as pure functions that take (event, state)
    and return ValidationResult.
    """

    def validate(self, event: AnyEvent, current_state: SakState) -> ValidationResult:
        """
        Run all applicable rules for the given event type.
        Returns first violation found, or success if all pass.
        """
        rules = self._get_rules_for_event(event.event_type)

        for rule_name, rule_fn in rules:
            result = rule_fn(event, current_state)
            if not result.is_valid:
                result.violated_rule = rule_name
                return result

        return ValidationResult(is_valid=True)

    def _get_rules_for_event(self, event_type: EventType) -> List[Tuple[str, Callable]]:
        """Map event types to applicable rules."""

        # Rules that apply to all events
        common_rules = [
            ("ROLE_CHECK", self._rule_role_check),
            ("CASE_NOT_CLOSED", self._rule_case_not_closed),
        ]

        # Event-specific rules
        specific_rules = {
            # Vederlag/Frist requires Grunnlag to be sent
            EventType.VEDERLAG_KRAV_SENDT: [
                ("GRUNNLAG_REQUIRED", self._rule_grunnlag_required),
            ],
            EventType.VEDERLAG_KRAV_OPPDATERT: [
                ("GRUNNLAG_REQUIRED", self._rule_grunnlag_required),
                ("ACTIVE_CLAIM_EXISTS", self._rule_active_vederlag_exists),
            ],
            EventType.FRIST_KRAV_SENDT: [
                ("GRUNNLAG_REQUIRED", self._rule_grunnlag_required),
            ],
            EventType.FRIST_KRAV_OPPDATERT: [
                ("GRUNNLAG_REQUIRED", self._rule_grunnlag_required),
                ("ACTIVE_CLAIM_EXISTS", self._rule_active_frist_exists),
            ],

            # BH responses require track to be sent
            EventType.RESPONS_GRUNNLAG: [
                ("TRACK_SENT", self._rule_grunnlag_sent),
                ("NOT_LOCKED", self._rule_grunnlag_not_locked),
            ],
            EventType.RESPONS_VEDERLAG: [
                ("TRACK_SENT", self._rule_vederlag_sent),
            ],
            EventType.RESPONS_FRIST: [
                ("TRACK_SENT", self._rule_frist_sent),
            ],

            # EO requires all tracks approved
            EventType.EO_UTSTEDT: [
                ("ALL_APPROVED", self._rule_all_approved_for_eo),
            ],

            # Cannot update locked grunnlag
            EventType.GRUNNLAG_OPPDATERT: [
                ("NOT_LOCKED", self._rule_grunnlag_not_locked),
            ],
        }

        return common_rules + specific_rules.get(event_type, [])

    # ========== COMMON RULES ==========

    def _rule_role_check(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Actor role must match allowed roles for event type."""
        te_only_events = {
            EventType.GRUNNLAG_OPPRETTET, EventType.GRUNNLAG_OPPDATERT,
            EventType.GRUNNLAG_TRUKKET,
            EventType.VEDERLAG_KRAV_SENDT, EventType.VEDERLAG_KRAV_OPPDATERT,
            EventType.VEDERLAG_KRAV_TRUKKET,
            EventType.FRIST_KRAV_SENDT, EventType.FRIST_KRAV_OPPDATERT,
            EventType.FRIST_KRAV_TRUKKET,
        }

        bh_only_events = {
            EventType.RESPONS_GRUNNLAG, EventType.RESPONS_VEDERLAG,
            EventType.RESPONS_FRIST, EventType.EO_UTSTEDT,
        }

        if event.event_type in te_only_events and event.aktor_rolle != "TE":
            return ValidationResult(
                is_valid=False,
                message="Kun TE kan utføre denne handlingen"
            )

        if event.event_type in bh_only_events and event.aktor_rolle != "BH":
            return ValidationResult(
                is_valid=False,
                message="Kun BH kan utføre denne handlingen"
            )

        return ValidationResult(is_valid=True)

    def _rule_case_not_closed(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot modify a closed case (except EO issuance which closes it)."""
        # EO_UTSTEDT is the event that closes the case, so it must be allowed
        if event.event_type == EventType.EO_UTSTEDT:
            return ValidationResult(is_valid=True)

        closed_statuses = {"OMFORENT", "LUKKET", "LUKKET_TRUKKET"}

        if state.overordnet_status in closed_statuses:
            # Allow only viewing, not modifications
            return ValidationResult(
                is_valid=False,
                message="Saken er lukket og kan ikke endres"
            )

        return ValidationResult(is_valid=True)

    # ========== GRUNNLAG RULES ==========

    def _rule_grunnlag_required(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Vederlag/Frist requires Grunnlag to be at least SENT."""
        invalid_statuses = {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}

        if state.grunnlag.status in invalid_statuses:
            return ValidationResult(
                is_valid=False,
                message="Grunnlag må være sendt før du kan sende krav"
            )

        return ValidationResult(is_valid=True)

    def _rule_grunnlag_sent(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot respond to unsent grunnlag."""
        invalid_statuses = {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}

        if state.grunnlag.status in invalid_statuses:
            return ValidationResult(
                is_valid=False,
                message="Kan ikke besvare grunnlag som ikke er sendt"
            )

        return ValidationResult(is_valid=True)

    def _rule_grunnlag_not_locked(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot modify locked grunnlag."""
        if state.grunnlag.laast or state.grunnlag.status == SporStatus.LAAST:
            return ValidationResult(
                is_valid=False,
                message="Grunnlag er låst og kan ikke endres"
            )

        return ValidationResult(is_valid=True)

    # ========== VEDERLAG RULES ==========

    def _rule_vederlag_sent(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot respond to unsent vederlag."""
        invalid_statuses = {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}

        if state.vederlag.status in invalid_statuses:
            return ValidationResult(
                is_valid=False,
                message="Kan ikke besvare vederlag som ikke er sendt"
            )

        return ValidationResult(is_valid=True)

    def _rule_active_vederlag_exists(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Can only update if there's an active vederlag claim."""
        if state.vederlag.status == SporStatus.IKKE_RELEVANT:
            return ValidationResult(
                is_valid=False,
                message="Ingen aktivt vederlagskrav å oppdatere"
            )

        return ValidationResult(is_valid=True)

    # ========== FRIST RULES ==========

    def _rule_frist_sent(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Cannot respond to unsent frist."""
        invalid_statuses = {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}

        if state.frist.status in invalid_statuses:
            return ValidationResult(
                is_valid=False,
                message="Kan ikke besvare frist som ikke er sendt"
            )

        return ValidationResult(is_valid=True)

    def _rule_active_frist_exists(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Can only update if there's an active frist claim."""
        if state.frist.status == SporStatus.IKKE_RELEVANT:
            return ValidationResult(
                is_valid=False,
                message="Ingen aktivt fristkrav å oppdatere"
            )

        return ValidationResult(is_valid=True)

    # ========== EO RULES ==========

    def _rule_all_approved_for_eo(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: All active tracks must be approved to issue EO."""
        if not state.kan_utstede_eo:
            return ValidationResult(
                is_valid=False,
                message="Alle aktive spor må være godkjent før EO kan utstedes"
            )

        return ValidationResult(is_valid=True)
