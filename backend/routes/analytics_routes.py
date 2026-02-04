"""
Analytics API for prosjekt- og porteføljeoversikt.

Demonstrerer hvordan event-sourced data kan aggregeres for analyse,
lignende Power BI mot Dataverse.

Optimalisert for ytelse ved å bruke cached metadata hvor mulig,
i stedet for full event replay.

Endpoints:
- GET /api/analytics/summary         - Overordnet sammendrag (cached)
- GET /api/analytics/by-category     - Saker fordelt på grunnlagskategori (cached)
- GET /api/analytics/by-status       - Saker fordelt på status (cached)
- GET /api/analytics/timeline        - Aktivitet over tid (events)
- GET /api/analytics/vederlag        - Vederlagsanalyse (cached + events for metode)
- GET /api/analytics/frist           - Fristforlengelse og dagmulkt (cached)
- GET /api/analytics/response-times  - Behandlingstider (events)
- GET /api/analytics/actors          - Aktøranalyse (events)
"""

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from flask import Blueprint, jsonify, request

from lib.auth.magic_link import require_magic_link
from models.events import parse_event
from models.sak_metadata import SakMetadata
from utils.logger import get_logger

logger = get_logger(__name__)

# Standard dagmulktsats (kr/dag) - brukt i fristberegninger
DAGMULKTSATS = 150000

analytics_bp = Blueprint("analytics", __name__)


# ---------------------------------------------------------------------------
# Dependency access via Container
# ---------------------------------------------------------------------------


def _get_container():
    """Hent DI Container."""
    from core.container import get_container

    return get_container()


def _get_event_repo():
    """Hent EventRepository fra Container."""
    return _get_container().event_repository


def _get_metadata_repo():
    """Hent SakMetadataRepository fra Container."""
    return _get_container().metadata_repository


def _get_timeline_service():
    """Hent TimelineService fra Container."""
    return _get_container().timeline_service


# ============================================================
# AGGREGATION HELPERS
# ============================================================


def _get_cached_metadata() -> list[SakMetadata]:
    """
    Hent cached metadata for alle saker.

    Brukes for raske aggregeringer uten event replay.
    Returnerer liste med SakMetadata objekter med cached felter.
    """
    try:
        return _get_metadata_repo().list_all()
    except Exception as e:
        logger.warning(f"Could not list metadata: {e}")
        return []


def _get_all_events_batch() -> list[dict[str, Any]]:
    """
    Hent alle events fra alle tabeller i batch (4 spørringer i stedet for N+1).

    Optimalisert versjon som unngår N+1 database-problemet ved å
    hente alle events fra hver tabell i én spørring.
    """
    from lib.supabase import with_retry

    all_events = []
    container = _get_container()

    # Sjekk om vi har Supabase-klient tilgjengelig
    event_repo = container.event_repository
    if not hasattr(event_repo, "client"):
        # Fallback til N+1 hvis ikke Supabase
        logger.warning("Batch fetch not available, falling back to N+1")
        return _get_all_events_n_plus_one()

    client = event_repo.client

    # Hent fra alle event-tabeller i batch (4 spørringer totalt)
    tables = ["koe_events", "forsering_events", "endringsordre_events", "fravik_events"]

    @with_retry()
    def fetch_table(table_name: str) -> list[dict]:
        result = client.table(table_name).select("*").execute()
        return result.data or []

    for table in tables:
        try:
            rows = fetch_table(table)
            for row in rows:
                # Konverter til event-format
                evt = {
                    "_sak_id": row.get("sak_id"),
                    "event_type": row.get("event_type"),
                    "tidsstempel": row.get("tidsstempel"),
                    "aktor": row.get("aktor"),
                    "aktor_rolle": row.get("aktor_rolle"),
                    "data": row.get("data", {}),
                }
                # Legg til CloudEvents time hvis tilgjengelig
                if row.get("time"):
                    evt["time"] = row.get("time")
                all_events.append(evt)
        except Exception as e:
            logger.warning(f"Could not fetch from {table}: {e}")

    logger.info(f"Batch fetched {len(all_events)} events from {len(tables)} tables")
    return all_events


def _get_all_events_n_plus_one() -> list[dict[str, Any]]:
    """
    Fallback: Hent events med N+1 kall (for non-Supabase backends).
    """
    all_events = []

    try:
        cases = _get_metadata_repo().list_all()
        sak_ids = [c.sak_id for c in cases]
    except Exception as e:
        logger.warning(f"Could not list cases from metadata: {e}")
        sak_ids = _get_event_repo().get_all_sak_ids()

    for sak_id in sak_ids:
        try:
            events_data, version = _get_event_repo().get_events(sak_id)
            for evt in events_data:
                evt["_sak_id"] = sak_id
                all_events.append(evt)
        except Exception as e:
            logger.warning(f"Could not load events for {sak_id}: {e}")

    return all_events


def _compute_all_states() -> dict[str, Any]:
    """
    Beregn current state for alle saker.

    MERK: Denne funksjonen er kostbar (full event replay).
    Bruk kun når du trenger detaljer som ikke er i cached metadata.
    For de fleste aggregeringer, bruk _get_cached_metadata() i stedet.

    Returnerer dict med sak_id -> state
    """
    states = {}

    try:
        cases = _get_metadata_repo().list_all()
        sak_ids = [c.sak_id for c in cases]
    except Exception:
        sak_ids = _get_event_repo().get_all_sak_ids()

    for sak_id in sak_ids:
        try:
            events_data, _ = _get_event_repo().get_events(sak_id)
            if events_data:
                events = [parse_event(e) for e in events_data]
                state = _get_timeline_service().compute_state(events)
                states[sak_id] = state
        except Exception as e:
            logger.warning(f"Could not compute state for {sak_id}: {e}")

    return states


# ============================================================
# API ENDPOINTS
# ============================================================


@analytics_bp.route("/api/analytics/summary", methods=["GET"])
@require_magic_link
def get_summary():
    """
    Overordnet sammendrag av alle saker.

    Optimalisert: Bruker cached metadata i stedet for full event replay.

    Response:
    {
        "total_cases": 45,
        "by_sakstype": {
            "standard": 38,
            "forsering": 4,
            "endringsordre": 3
        },
        "by_status": {
            "under_behandling": 15,
            "godkjent": 12,
            "avslatt": 8,
            ...
        },
        "total_vederlag_krevd": 4500000,
        "total_vederlag_godkjent": 3200000,
        "last_activity": "2025-01-15T10:30:00Z"
    }
    """
    try:
        # Bruk cached metadata - mye raskere enn full state computation
        cases = _get_cached_metadata()

        # Aggreger fra cached felter
        by_sakstype = defaultdict(int)
        by_status = defaultdict(int)
        total_vederlag_krevd = 0
        total_vederlag_godkjent = 0
        last_activity = None

        for case in cases:
            # Sakstype
            sakstype = case.sakstype or "standard"
            by_sakstype[sakstype] += 1

            # Status fra cached felt
            status = case.cached_status or "ukjent"
            by_status[status] += 1

            # Vederlag fra cached felter
            if case.cached_sum_krevd:
                total_vederlag_krevd += case.cached_sum_krevd
            if case.cached_sum_godkjent:
                total_vederlag_godkjent += case.cached_sum_godkjent

            # Siste aktivitet
            if case.last_event_at:
                if last_activity is None or case.last_event_at > last_activity:
                    last_activity = case.last_event_at

        return jsonify(
            {
                "total_cases": len(cases),
                "by_sakstype": dict(by_sakstype),
                "by_status": dict(by_status),
                "total_vederlag_krevd": total_vederlag_krevd,
                "total_vederlag_godkjent": total_vederlag_godkjent,
                "godkjenningsgrad_vederlag": round(
                    total_vederlag_godkjent / total_vederlag_krevd * 100, 1
                )
                if total_vederlag_krevd > 0
                else 0,
                "last_activity": last_activity.isoformat() if last_activity else None,
            }
        )

    except Exception as e:
        logger.error(f"Analytics summary failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route("/api/analytics/by-category", methods=["GET"])
@require_magic_link
def get_by_category():
    """
    Fordeling av saker etter grunnlagskategori.

    Optimalisert: Bruker cached metadata i stedet for full event replay.

    Response:
    {
        "categories": [
            {
                "kategori": "ENDRING",
                "antall": 15,
                "godkjent": 10,
                "avslatt": 3,
                "under_behandling": 2,
                "godkjenningsrate": 66.7
            },
            ...
        ]
    }
    """
    try:
        # Bruk cached metadata
        cases = _get_cached_metadata()

        # Aggreger per kategori
        by_category = defaultdict(
            lambda: {
                "antall": 0,
                "godkjent": 0,
                "delvis_godkjent": 0,
                "avslatt": 0,
                "under_behandling": 0,
            }
        )

        for case in cases:
            kategori = case.cached_hovedkategori or "UKJENT"
            by_category[kategori]["antall"] += 1

            # Status fra cached felt
            status = (case.cached_status or "").lower()
            if "godkjent" in status and "delvis" not in status:
                by_category[kategori]["godkjent"] += 1
            elif "delvis" in status:
                by_category[kategori]["delvis_godkjent"] += 1
            elif "avslatt" in status or "avslått" in status:
                by_category[kategori]["avslatt"] += 1
            else:
                by_category[kategori]["under_behandling"] += 1

        # Beregn godkjenningsrate
        result = []
        for kategori, data in sorted(
            by_category.items(), key=lambda x: -x[1]["antall"]
        ):
            ferdigbehandlet = (
                data["godkjent"] + data["delvis_godkjent"] + data["avslatt"]
            )
            godkjenningsrate = 0
            if ferdigbehandlet > 0:
                godkjenningsrate = round(
                    (data["godkjent"] + data["delvis_godkjent"])
                    / ferdigbehandlet
                    * 100,
                    1,
                )

            result.append(
                {
                    "kategori": kategori,
                    "antall": data["antall"],
                    "godkjent": data["godkjent"],
                    "delvis_godkjent": data["delvis_godkjent"],
                    "avslatt": data["avslatt"],
                    "under_behandling": data["under_behandling"],
                    "godkjenningsrate": godkjenningsrate,
                }
            )

        return jsonify({"categories": result})

    except Exception as e:
        logger.error(f"Analytics by-category failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route("/api/analytics/timeline", methods=["GET"])
@require_magic_link
def get_activity_timeline():
    """
    Aktivitet over tid (events per dag/uke/måned).

    Query params:
    - period: 'day' | 'week' | 'month' (default: 'week')
    - days: Number of days back (default: 90)

    Response:
    {
        "period": "week",
        "data": [
            {"date": "2025-01-06", "events": 15, "new_cases": 3},
            {"date": "2025-01-13", "events": 22, "new_cases": 5},
            ...
        ]
    }
    """
    try:
        period = request.args.get("period", "week")
        days_back = int(request.args.get("days", 90))

        all_events = _get_all_events_batch()
        cutoff = datetime.now(UTC) - timedelta(days=days_back)

        # Aggreger per periode
        by_period = defaultdict(lambda: {"events": 0, "new_cases": 0})

        for evt in all_events:
            ts = evt.get("tidsstempel") or evt.get("time")
            if not ts:
                continue

            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(
                        ts.replace("Z", "+00:00").replace(" ", "T")
                    )
                except ValueError:
                    continue

            # Håndter timezone-naive vs aware sammenligning
            if ts.tzinfo is None:
                # Anta UTC for naive timestamps
                ts = ts.replace(tzinfo=UTC)

            if ts < cutoff:
                continue

            # Bestem periode-nøkkel
            if period == "day":
                key = ts.strftime("%Y-%m-%d")
            elif period == "week":
                # Start of week (Monday)
                week_start = ts - timedelta(days=ts.weekday())
                key = week_start.strftime("%Y-%m-%d")
            else:  # month
                key = ts.strftime("%Y-%m-01")

            by_period[key]["events"] += 1

            # Sjekk om dette er en ny sak
            event_type = evt.get("event_type", "")
            if event_type == "sak_opprettet":
                by_period[key]["new_cases"] += 1

        # Sorter og formater
        result = [
            {"date": date, "events": data["events"], "new_cases": data["new_cases"]}
            for date, data in sorted(by_period.items())
        ]

        return jsonify({"period": period, "days_back": days_back, "data": result})

    except Exception as e:
        logger.error(f"Analytics timeline failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route("/api/analytics/vederlag", methods=["GET"])
@require_magic_link
def get_vederlag_analytics():
    """
    Vederlagsanalyse - beløp, metoder, godkjenningsgrad.

    Optimalisert: Bruker cached metadata for totaler.
    Metode-breakdown krever fortsatt event-data (ikke cached).

    Response:
    {
        "summary": {
            "total_krevd": 4500000,
            "total_godkjent": 3200000,
            "godkjenningsgrad": 71.1,
            "avg_krav": 112500,
            "avg_godkjent": 106667
        },
        "by_metode": [...],
        "krav_distribution": [...]
    }
    """
    try:
        # Bruk cached metadata for totaler
        cases = _get_cached_metadata()

        total_krevd = 0
        total_godkjent = 0
        krav_count = 0
        godkjent_count = 0
        krav_amounts = []

        for case in cases:
            if case.cached_sum_krevd and case.cached_sum_krevd > 0:
                krav_count += 1
                total_krevd += case.cached_sum_krevd
                krav_amounts.append(case.cached_sum_krevd)

            if case.cached_sum_godkjent and case.cached_sum_godkjent > 0:
                godkjent_count += 1
                total_godkjent += case.cached_sum_godkjent

        # Krav-distribusjon (fra cached beløp)
        distribution = [
            {"range": "0-50k", "count": 0},
            {"range": "50k-100k", "count": 0},
            {"range": "100k-500k", "count": 0},
            {"range": "500k-1M", "count": 0},
            {"range": "1M+", "count": 0},
        ]

        for amount in krav_amounts:
            if amount < 50000:
                distribution[0]["count"] += 1
            elif amount < 100000:
                distribution[1]["count"] += 1
            elif amount < 500000:
                distribution[2]["count"] += 1
            elif amount < 1000000:
                distribution[3]["count"] += 1
            else:
                distribution[4]["count"] += 1

        # For metode-breakdown trenger vi events (ikke cachet ennå)
        # TODO: Legg til cached_metode i metadata for full optimalisering
        by_metode = defaultdict(
            lambda: {"antall": 0, "total_krevd": 0, "total_godkjent": 0}
        )

        # Kun hent events for saker med vederlag (lazy loading)
        sak_ids_with_vederlag = [
            c.sak_id for c in cases if c.cached_sum_krevd and c.cached_sum_krevd > 0
        ]

        for sak_id in sak_ids_with_vederlag:
            try:
                events_data, _ = _get_event_repo().get_events(sak_id)
                metode = "UKJENT"
                krevd = 0
                godkjent = 0

                for evt in events_data:
                    event_type = evt.get("event_type", "")
                    data = evt.get("data", {})

                    if event_type == "vederlag_krav_sendt":
                        metode = data.get("metode") or "UKJENT"
                        krevd = data.get("belop") or 0
                    elif event_type == "respons_vederlag":
                        godkjent = data.get("godkjent_belop") or 0

                if krevd > 0:
                    by_metode[metode]["antall"] += 1
                    by_metode[metode]["total_krevd"] += krevd
                    by_metode[metode]["total_godkjent"] += godkjent

            except Exception:
                pass  # Skip problematiske saker

        # Formater metode-data
        metode_result = []
        for metode, data in sorted(
            by_metode.items(), key=lambda x: -x[1]["total_krevd"]
        ):
            godkjenningsgrad = 0
            if data["total_krevd"] > 0:
                godkjenningsgrad = round(
                    data["total_godkjent"] / data["total_krevd"] * 100, 1
                )

            metode_result.append(
                {
                    "metode": metode,
                    "antall": data["antall"],
                    "total_krevd": data["total_krevd"],
                    "total_godkjent": data["total_godkjent"],
                    "godkjenningsgrad": godkjenningsgrad,
                }
            )

        return jsonify(
            {
                "summary": {
                    "total_krevd": total_krevd,
                    "total_godkjent": total_godkjent,
                    "godkjenningsgrad": round(total_godkjent / total_krevd * 100, 1)
                    if total_krevd > 0
                    else 0,
                    "antall_krav": krav_count,
                    "avg_krav": round(total_krevd / krav_count) if krav_count > 0 else 0,
                    "avg_godkjent": round(total_godkjent / godkjent_count)
                    if godkjent_count > 0
                    else 0,
                },
                "by_metode": metode_result,
                "krav_distribution": distribution,
            }
        )

    except Exception as e:
        logger.error(f"Analytics vederlag failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route("/api/analytics/frist", methods=["GET"])
@require_magic_link
def get_frist_analytics():
    """
    Fristforlengelse og dagmulkt-analyse.

    Optimalisert: Bruker cached metadata for dager krevd/godkjent.

    Response:
    {
        "summary": {
            "total_dager_krevd": 120,
            "total_dager_godkjent": 85,
            "godkjenningsgrad": 70.8,
            "antall_krav": 15
        },
        "dagmulktsats": 150000,
        "eksponering_krevd": 18000000,
        "eksponering_godkjent": 12750000
    }
    """
    try:
        # Bruk cached metadata
        cases = _get_cached_metadata()

        total_dager_krevd = 0
        total_dager_godkjent = 0
        antall_krav = 0

        for case in cases:
            if case.cached_dager_krevd and case.cached_dager_krevd > 0:
                antall_krav += 1
                total_dager_krevd += case.cached_dager_krevd

            if case.cached_dager_godkjent and case.cached_dager_godkjent > 0:
                total_dager_godkjent += case.cached_dager_godkjent

        # Beregn økonomisk eksponering
        eksponering_krevd = total_dager_krevd * DAGMULKTSATS
        eksponering_godkjent = total_dager_godkjent * DAGMULKTSATS

        godkjenningsgrad = 0
        if total_dager_krevd > 0:
            godkjenningsgrad = round(
                total_dager_godkjent / total_dager_krevd * 100, 1
            )

        return jsonify(
            {
                "summary": {
                    "total_dager_krevd": total_dager_krevd,
                    "total_dager_godkjent": total_dager_godkjent,
                    "godkjenningsgrad": godkjenningsgrad,
                    "antall_krav": antall_krav,
                },
                "dagmulktsats": DAGMULKTSATS,
                "eksponering_krevd": eksponering_krevd,
                "eksponering_godkjent": eksponering_godkjent,
            }
        )

    except Exception as e:
        logger.error(f"Analytics frist failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route("/api/analytics/response-times", methods=["GET"])
@require_magic_link
def get_response_times():
    """
    Behandlingstider - hvor lang tid tar det fra krav til respons?

    Optimalisert: Bruker batch-henting (4 spørringer i stedet for N+1).

    Response:
    {
        "grunnlag": {
            "avg_days": 5.2,
            "median_days": 4,
            "min_days": 1,
            "max_days": 21
        },
        "vederlag": {
            "avg_days": 8.5,
            ...
        },
        "frist": {
            "avg_days": 6.3,
            ...
        }
    }
    """
    try:
        # Batch-hent alle events (4 spørringer totalt)
        all_events = _get_all_events_batch()

        # Grupper events per sak
        all_cases_events: dict[str, list] = {}
        for evt in all_events:
            sak_id = evt.get("_sak_id")
            if sak_id:
                if sak_id not in all_cases_events:
                    all_cases_events[sak_id] = []
                all_cases_events[sak_id].append(evt)

        # Logg statistikk for debugging
        logger.info(
            f"Response times calculation: {len(all_cases_events)} cases, {len(all_events)} total events"
        )

        # Beregn behandlingstider per spor
        def parse_timestamp(ts):
            """Parse tidsstempel til datetime, håndterer både streng og datetime-objekter."""
            if ts is None:
                return None
            if isinstance(ts, datetime):
                return ts
            if isinstance(ts, str):
                try:
                    # Håndter ulike ISO 8601-formater
                    ts = ts.replace("Z", "+00:00").replace(" ", "T")
                    return datetime.fromisoformat(ts)
                except ValueError:
                    return None
            return None

        def calculate_response_times(krav_type: str, respons_type: str) -> dict:
            times = []
            krav_count = 0
            respons_count = 0

            for events in all_cases_events.values():
                krav_time = None
                respons_time = None

                for evt in events:
                    event_type = evt.get("event_type", "")
                    # Hent tidsstempel - prøv flere kilder
                    ts = evt.get("tidsstempel")
                    if ts is None:
                        # Fallback til CloudEvents time
                        ce = evt.get("_cloudevents", {})
                        ts = ce.get("time") if ce else None

                    ts = parse_timestamp(ts)
                    if ts is None:
                        continue

                    if event_type == krav_type and krav_time is None:
                        krav_time = ts
                        krav_count += 1
                    elif event_type == respons_type and respons_time is None:
                        respons_time = ts
                        respons_count += 1

                if krav_time and respons_time:
                    delta = (respons_time - krav_time).days
                    if delta >= 0:
                        times.append(delta)

            logger.debug(
                f"Response times for {krav_type}->{respons_type}: "
                f"found {krav_count} krav, {respons_count} respons, {len(times)} pairs"
            )

            if not times:
                return {
                    "avg_days": None,
                    "median_days": None,
                    "min_days": None,
                    "max_days": None,
                    "sample_size": 0,
                }

            times.sort()
            return {
                "avg_days": round(sum(times) / len(times), 1),
                "median_days": times[len(times) // 2],
                "min_days": min(times),
                "max_days": max(times),
                "sample_size": len(times),
            }

        return jsonify(
            {
                "grunnlag": calculate_response_times(
                    "grunnlag_opprettet", "respons_grunnlag"
                ),
                "vederlag": calculate_response_times(
                    "vederlag_krav_sendt", "respons_vederlag"
                ),
                "frist": calculate_response_times("frist_krav_sendt", "respons_frist"),
            }
        )

    except Exception as e:
        logger.error(f"Analytics response-times failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route("/api/analytics/actors", methods=["GET"])
@require_magic_link
def get_actor_analytics():
    """
    Analyse per aktør - hvem gjør hva?

    Response:
    {
        "by_role": {
            "TE": {"events": 180, "unique_actors": 5},
            "BH": {"events": 132, "unique_actors": 3}
        },
        "top_actors": [
            {"name": "Ola Nordmann", "role": "TE", "events": 45},
            ...
        ]
    }
    """
    try:
        all_events = _get_all_events_batch()

        by_role = defaultdict(lambda: {"events": 0, "actors": set()})
        by_actor = defaultdict(lambda: {"events": 0, "role": None})

        for evt in all_events:
            actor = evt.get("aktor") or evt.get("actor") or "Ukjent"
            role = evt.get("aktor_rolle") or evt.get("actorrole") or "Ukjent"

            by_role[role]["events"] += 1
            by_role[role]["actors"].add(actor)

            by_actor[actor]["events"] += 1
            by_actor[actor]["role"] = role

        # Formater rolle-data
        role_result = {}
        for role, data in by_role.items():
            role_result[role] = {
                "events": data["events"],
                "unique_actors": len(data["actors"]),
            }

        # Top aktører
        top_actors = sorted(
            [
                {"name": name, "role": data["role"], "events": data["events"]}
                for name, data in by_actor.items()
            ],
            key=lambda x: -x["events"],
        )[:10]

        return jsonify({"by_role": role_result, "top_actors": top_actors})

    except Exception as e:
        logger.error(f"Analytics actors failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
