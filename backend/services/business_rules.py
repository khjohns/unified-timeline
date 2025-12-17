"""
Business rule validation before event persistence.

All rules are validated BEFORE events are stored.
This ensures the event log never contains invalid state transitions.
"""
from dataclasses import dataclass
from typing import Optional, List, Tuple, Callable
from models.events import AnyEvent, EventType, SporStatus
from models.sak_state import SakState, SaksType, EOStatus


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

            # Cannot update locked grunnlag
            EventType.GRUNNLAG_OPPDATERT: [
                ("NOT_LOCKED", self._rule_grunnlag_not_locked),
            ],

            # ========== ENDRINGSORDRE RULES ==========

            # EO opprettelse - ingen spesifikke regler utover rolle-sjekk
            EventType.EO_OPPRETTET: [],

            # EO KOE-håndtering - må være i ENDRINGSORDRE-sak
            EventType.EO_KOE_LAGT_TIL: [
                ("IS_EO_CASE", self._rule_is_eo_case),
            ],
            EventType.EO_KOE_FJERNET: [
                ("IS_EO_CASE", self._rule_is_eo_case),
            ],

            # EO utstedelse - kan være fra KOE (alle godkjent) eller proaktiv (EO-sak)
            EventType.EO_UTSTEDT: [
                ("EO_CAN_BE_ISSUED", self._rule_eo_can_be_issued),
            ],

            # EO aksept/bestridelse - EO må være utstedt først
            EventType.EO_AKSEPTERT: [
                ("IS_EO_CASE", self._rule_is_eo_case),
                ("EO_IS_ISSUED", self._rule_eo_is_issued),
            ],
            EventType.EO_BESTRIDT: [
                ("IS_EO_CASE", self._rule_is_eo_case),
                ("EO_IS_ISSUED", self._rule_eo_is_issued),
            ],

            # EO revisjon - EO må være utstedt og bestridt
            EventType.EO_REVIDERT: [
                ("IS_EO_CASE", self._rule_is_eo_case),
                ("EO_IS_ISSUED", self._rule_eo_is_issued),
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
            # EO TE-handlinger
            EventType.EO_AKSEPTERT, EventType.EO_BESTRIDT,
        }

        bh_only_events = {
            EventType.RESPONS_GRUNNLAG, EventType.RESPONS_VEDERLAG,
            EventType.RESPONS_FRIST,
            # EO BH-handlinger
            EventType.EO_OPPRETTET, EventType.EO_KOE_LAGT_TIL,
            EventType.EO_KOE_FJERNET, EventType.EO_UTSTEDT, EventType.EO_REVIDERT,
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
        """R: Cannot modify a closed case (except EO events which have own lifecycle)."""
        # EO events are allowed - they have their own lifecycle
        eo_events = {
            EventType.EO_OPPRETTET, EventType.EO_KOE_LAGT_TIL,
            EventType.EO_KOE_FJERNET, EventType.EO_UTSTEDT,
            EventType.EO_AKSEPTERT, EventType.EO_BESTRIDT, EventType.EO_REVIDERT,
        }
        if event.event_type in eo_events:
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
        # IKKE_RELEVANT = track not used, UTKAST = no claim submitted yet
        if state.vederlag.status in {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}:
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
        # IKKE_RELEVANT = track not used, UTKAST = no claim submitted yet
        if state.frist.status in {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}:
            return ValidationResult(
                is_valid=False,
                message="Ingen aktivt fristkrav å oppdatere"
            )

        return ValidationResult(is_valid=True)

    # ========== EO RULES ==========

    def _rule_is_eo_case(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: Event requires an ENDRINGSORDRE case type."""
        if state.sakstype != SaksType.ENDRINGSORDRE:
            return ValidationResult(
                is_valid=False,
                message="Denne handlingen krever en endringsordre-sak"
            )

        return ValidationResult(is_valid=True)

    def _rule_eo_can_be_issued(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """
        R: EO can be issued if:
        - From a STANDARD case: All active tracks must be approved (kan_utstede_eo)
        - From an ENDRINGSORDRE case: Always allowed (proactive EO)
        """
        # Proaktiv EO fra EO-sak - alltid tillatt
        if state.sakstype == SaksType.ENDRINGSORDRE:
            return ValidationResult(is_valid=True)

        # Reaktiv EO fra KOE-sak - alle spor må være godkjent
        if state.sakstype == SaksType.STANDARD:
            if not state.kan_utstede_eo:
                return ValidationResult(
                    is_valid=False,
                    message="Alle aktive spor må være godkjent før EO kan utstedes"
                )
            return ValidationResult(is_valid=True)

        # Andre sakstyper (f.eks. FORSERING) - ikke tillatt
        return ValidationResult(
            is_valid=False,
            message="EO kan ikke utstedes fra denne sakstypen"
        )

    def _rule_eo_is_issued(self, event: AnyEvent, state: SakState) -> ValidationResult:
        """R: EO must be issued before it can be accepted/disputed/revised."""
        if state.endringsordre_data is None:
            return ValidationResult(
                is_valid=False,
                message="Endringsordre-data mangler"
            )

        if state.endringsordre_data.status not in {EOStatus.UTSTEDT, EOStatus.BESTRIDT, EOStatus.REVIDERT}:
            return ValidationResult(
                is_valid=False,
                message="Endringsordren må være utstedt før den kan aksepteres/bestrides"
            )

        return ValidationResult(is_valid=True)
