"""
Analytics API for prosjekt- og porteføljeoversikt.

Demonstrerer hvordan event-sourced data kan aggregeres for analyse,
lignende Power BI mot Dataverse.

Endpoints:
- GET /api/analytics/summary         - Overordnet sammendrag
- GET /api/analytics/by-category     - Saker fordelt på grunnlagskategori
- GET /api/analytics/by-status       - Saker fordelt på status
- GET /api/analytics/timeline        - Aktivitet over tid
- GET /api/analytics/vederlag        - Vederlagsanalyse (beløp, metoder)
- GET /api/analytics/response-times  - Behandlingstider
"""

from flask import Blueprint, jsonify, request
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import Dict, List, Any

from repositories import create_event_repository
from repositories.supabase_sak_metadata_repository import create_metadata_repository
from services.timeline_service import TimelineService
from models.events import parse_event
from lib.auth.magic_link import require_magic_link
from utils.logger import get_logger

logger = get_logger(__name__)

analytics_bp = Blueprint('analytics', __name__)

# Dependencies
event_repo = create_event_repository()
metadata_repo = create_metadata_repository()
timeline_service = TimelineService()


# ============================================================
# AGGREGATION HELPERS
# ============================================================

def _get_all_events_with_metadata() -> List[Dict[str, Any]]:
    """
    Hent alle events fra alle saker med metadata.

    I produksjon ville dette bruke database views/aggregeringer,
    men for prototypen laster vi og prosesserer i Python.
    """
    all_events = []

    # Hent alle sak_ids fra metadata
    try:
        cases = metadata_repo.list_all()
        sak_ids = [c.sak_id for c in cases]
    except Exception as e:
        logger.warning(f"Could not list cases from metadata: {e}")
        sak_ids = event_repo.get_all_sak_ids()

    for sak_id in sak_ids:
        try:
            events_data, version = event_repo.get_events(sak_id)
            for evt in events_data:
                evt['_sak_id'] = sak_id
                all_events.append(evt)
        except Exception as e:
            logger.warning(f"Could not load events for {sak_id}: {e}")

    return all_events


def _compute_all_states() -> Dict[str, Any]:
    """
    Beregn current state for alle saker.

    Returnerer dict med sak_id -> state
    """
    states = {}

    try:
        cases = metadata_repo.list_all()
        sak_ids = [c.sak_id for c in cases]
    except Exception:
        sak_ids = event_repo.get_all_sak_ids()

    for sak_id in sak_ids:
        try:
            events_data, _ = event_repo.get_events(sak_id)
            if events_data:
                events = [parse_event(e) for e in events_data]
                state = timeline_service.compute_state(events)
                states[sak_id] = state
        except Exception as e:
            logger.warning(f"Could not compute state for {sak_id}: {e}")

    return states


# ============================================================
# API ENDPOINTS
# ============================================================

@analytics_bp.route('/api/analytics/summary', methods=['GET'])
@require_magic_link
def get_summary():
    """
    Overordnet sammendrag av alle saker.

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
        "total_events": 312,
        "total_vederlag_krevd": 4500000,
        "total_vederlag_godkjent": 3200000,
        "avg_events_per_case": 6.9,
        "last_activity": "2025-01-15T10:30:00Z"
    }
    """
    try:
        states = _compute_all_states()
        all_events = _get_all_events_with_metadata()

        # Aggreger
        by_sakstype = defaultdict(int)
        by_status = defaultdict(int)
        total_vederlag_krevd = 0
        total_vederlag_godkjent = 0
        last_activity = None

        for sak_id, state in states.items():
            # Sakstype - bruk enum value for riktig JSON-serialisering
            sakstype_enum = getattr(state, 'sakstype', None)
            sakstype = sakstype_enum.value if sakstype_enum else 'standard'
            by_sakstype[sakstype] += 1

            # Status
            status = str(state.overordnet_status) if state.overordnet_status else 'ukjent'
            by_status[status] += 1

            # Vederlag - bruk flate felter fra VederlagTilstand
            if state.vederlag:
                krevd = state.vederlag.krevd_belop
                if krevd:
                    total_vederlag_krevd += krevd

                godkjent = state.vederlag.godkjent_belop
                if godkjent:
                    total_vederlag_godkjent += godkjent

        # Finn siste aktivitet
        for evt in all_events:
            ts = evt.get('tidsstempel') or evt.get('time')
            if ts:
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts.replace('Z', '+00:00').replace(' ', 'T'))
                    except ValueError:
                        continue
                if last_activity is None or ts > last_activity:
                    last_activity = ts

        return jsonify({
            "total_cases": len(states),
            "by_sakstype": dict(by_sakstype),
            "by_status": dict(by_status),
            "total_events": len(all_events),
            "total_vederlag_krevd": total_vederlag_krevd,
            "total_vederlag_godkjent": total_vederlag_godkjent,
            "godkjenningsgrad_vederlag": round(total_vederlag_godkjent / total_vederlag_krevd * 100, 1) if total_vederlag_krevd > 0 else 0,
            "avg_events_per_case": round(len(all_events) / len(states), 1) if states else 0,
            "last_activity": last_activity.isoformat() if last_activity else None
        })

    except Exception as e:
        logger.error(f"Analytics summary failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route('/api/analytics/by-category', methods=['GET'])
@require_magic_link
def get_by_category():
    """
    Fordeling av saker etter grunnlagskategori.

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
        states = _compute_all_states()

        # Aggreger per kategori
        by_category = defaultdict(lambda: {
            'antall': 0,
            'godkjent': 0,
            'delvis_godkjent': 0,
            'avslatt': 0,
            'under_behandling': 0
        })

        for sak_id, state in states.items():
            if state.grunnlag and state.grunnlag.hovedkategori:
                kategori = state.grunnlag.hovedkategori or 'UKJENT'
                by_category[kategori]['antall'] += 1

                # Status for grunnlag - bruk status enum direkte
                grunnlag_status = str(state.grunnlag.status.value) if state.grunnlag.status else ''
                if 'godkjent' in grunnlag_status.lower() and 'delvis' not in grunnlag_status.lower():
                    by_category[kategori]['godkjent'] += 1
                elif 'delvis' in grunnlag_status.lower():
                    by_category[kategori]['delvis_godkjent'] += 1
                elif 'avslatt' in grunnlag_status.lower():
                    by_category[kategori]['avslatt'] += 1
                else:
                    by_category[kategori]['under_behandling'] += 1

        # Beregn godkjenningsrate
        result = []
        for kategori, data in sorted(by_category.items(), key=lambda x: -x[1]['antall']):
            ferdigbehandlet = data['godkjent'] + data['delvis_godkjent'] + data['avslatt']
            godkjenningsrate = 0
            if ferdigbehandlet > 0:
                godkjenningsrate = round((data['godkjent'] + data['delvis_godkjent']) / ferdigbehandlet * 100, 1)

            result.append({
                'kategori': kategori,
                'antall': data['antall'],
                'godkjent': data['godkjent'],
                'delvis_godkjent': data['delvis_godkjent'],
                'avslatt': data['avslatt'],
                'under_behandling': data['under_behandling'],
                'godkjenningsrate': godkjenningsrate
            })

        return jsonify({"categories": result})

    except Exception as e:
        logger.error(f"Analytics by-category failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route('/api/analytics/timeline', methods=['GET'])
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
        period = request.args.get('period', 'week')
        days_back = int(request.args.get('days', 90))

        all_events = _get_all_events_with_metadata()
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)

        # Aggreger per periode
        by_period = defaultdict(lambda: {'events': 0, 'new_cases': 0})

        for evt in all_events:
            ts = evt.get('tidsstempel') or evt.get('time')
            if not ts:
                continue

            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace('Z', '+00:00').replace(' ', 'T'))
                except ValueError:
                    continue

            if ts < cutoff:
                continue

            # Bestem periode-nøkkel
            if period == 'day':
                key = ts.strftime('%Y-%m-%d')
            elif period == 'week':
                # Start of week (Monday)
                week_start = ts - timedelta(days=ts.weekday())
                key = week_start.strftime('%Y-%m-%d')
            else:  # month
                key = ts.strftime('%Y-%m-01')

            by_period[key]['events'] += 1

            # Sjekk om dette er en ny sak
            event_type = evt.get('event_type', '')
            if event_type == 'sak_opprettet':
                by_period[key]['new_cases'] += 1

        # Sorter og formater
        result = [
            {'date': date, 'events': data['events'], 'new_cases': data['new_cases']}
            for date, data in sorted(by_period.items())
        ]

        return jsonify({
            "period": period,
            "days_back": days_back,
            "data": result
        })

    except Exception as e:
        logger.error(f"Analytics timeline failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route('/api/analytics/vederlag', methods=['GET'])
@require_magic_link
def get_vederlag_analytics():
    """
    Vederlagsanalyse - beløp, metoder, godkjenningsgrad.

    Response:
    {
        "summary": {
            "total_krevd": 4500000,
            "total_godkjent": 3200000,
            "godkjenningsgrad": 71.1,
            "avg_krav": 112500,
            "avg_godkjent": 106667
        },
        "by_metode": [
            {
                "metode": "ENHETSPRISER",
                "antall": 20,
                "total_krevd": 2000000,
                "total_godkjent": 1600000,
                "godkjenningsgrad": 80.0
            },
            ...
        ],
        "krav_distribution": [
            {"range": "0-50k", "count": 12},
            {"range": "50k-100k", "count": 8},
            {"range": "100k-500k", "count": 15},
            {"range": "500k+", "count": 5}
        ]
    }
    """
    try:
        states = _compute_all_states()

        # Aggreger
        total_krevd = 0
        total_godkjent = 0
        krav_count = 0
        godkjent_count = 0

        by_metode = defaultdict(lambda: {
            'antall': 0,
            'total_krevd': 0,
            'total_godkjent': 0
        })

        krav_amounts = []

        for sak_id, state in states.items():
            if not state.vederlag:
                continue

            # Bruk flate felter fra VederlagTilstand
            metode = state.vederlag.metode or 'UKJENT'
            belop = state.vederlag.krevd_belop or 0

            if belop > 0:
                krav_count += 1
                total_krevd += belop
                by_metode[metode]['antall'] += 1
                by_metode[metode]['total_krevd'] += belop
                krav_amounts.append(belop)

            godkjent = state.vederlag.godkjent_belop or 0
            if godkjent > 0:
                godkjent_count += 1
                total_godkjent += godkjent
                by_metode[metode]['total_godkjent'] += godkjent

        # Krav-distribusjon
        distribution = [
            {'range': '0-50k', 'count': 0},
            {'range': '50k-100k', 'count': 0},
            {'range': '100k-500k', 'count': 0},
            {'range': '500k-1M', 'count': 0},
            {'range': '1M+', 'count': 0}
        ]

        for amount in krav_amounts:
            if amount < 50000:
                distribution[0]['count'] += 1
            elif amount < 100000:
                distribution[1]['count'] += 1
            elif amount < 500000:
                distribution[2]['count'] += 1
            elif amount < 1000000:
                distribution[3]['count'] += 1
            else:
                distribution[4]['count'] += 1

        # Formater metode-data
        metode_result = []
        for metode, data in sorted(by_metode.items(), key=lambda x: -x[1]['total_krevd']):
            godkjenningsgrad = 0
            if data['total_krevd'] > 0:
                godkjenningsgrad = round(data['total_godkjent'] / data['total_krevd'] * 100, 1)

            metode_result.append({
                'metode': metode,
                'antall': data['antall'],
                'total_krevd': data['total_krevd'],
                'total_godkjent': data['total_godkjent'],
                'godkjenningsgrad': godkjenningsgrad
            })

        return jsonify({
            "summary": {
                "total_krevd": total_krevd,
                "total_godkjent": total_godkjent,
                "godkjenningsgrad": round(total_godkjent / total_krevd * 100, 1) if total_krevd > 0 else 0,
                "antall_krav": krav_count,
                "avg_krav": round(total_krevd / krav_count) if krav_count > 0 else 0,
                "avg_godkjent": round(total_godkjent / godkjent_count) if godkjent_count > 0 else 0
            },
            "by_metode": metode_result,
            "krav_distribution": distribution
        })

    except Exception as e:
        logger.error(f"Analytics vederlag failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route('/api/analytics/response-times', methods=['GET'])
@require_magic_link
def get_response_times():
    """
    Behandlingstider - hvor lang tid tar det fra krav til respons?

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
        # Hent alle events gruppert per sak
        all_cases_events = {}

        try:
            cases = metadata_repo.list_all()
            sak_ids = [c.sak_id for c in cases]
        except Exception:
            sak_ids = event_repo.get_all_sak_ids()

        for sak_id in sak_ids:
            try:
                events_data, _ = event_repo.get_events(sak_id)
                all_cases_events[sak_id] = events_data
            except Exception:
                pass

        # Logg statistikk for debugging
        total_events = sum(len(events) for events in all_cases_events.values())
        logger.info(f"Response times calculation: {len(sak_ids)} cases, {len(all_cases_events)} with events, {total_events} total events")

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
                    ts = ts.replace('Z', '+00:00').replace(' ', 'T')
                    return datetime.fromisoformat(ts)
                except ValueError:
                    return None
            return None

        def calculate_response_times(krav_type: str, respons_type: str) -> Dict:
            times = []
            krav_count = 0
            respons_count = 0

            for sak_id, events in all_cases_events.items():
                krav_time = None
                respons_time = None

                for evt in events:
                    event_type = evt.get('event_type', '')
                    # Hent tidsstempel - prøv flere kilder
                    ts = evt.get('tidsstempel')
                    if ts is None:
                        # Fallback til CloudEvents time
                        ce = evt.get('_cloudevents', {})
                        ts = ce.get('time') if ce else None

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

            logger.debug(f"Response times for {krav_type}->{respons_type}: "
                        f"found {krav_count} krav, {respons_count} respons, {len(times)} pairs")

            if not times:
                return {
                    'avg_days': None,
                    'median_days': None,
                    'min_days': None,
                    'max_days': None,
                    'sample_size': 0
                }

            times.sort()
            return {
                'avg_days': round(sum(times) / len(times), 1),
                'median_days': times[len(times) // 2],
                'min_days': min(times),
                'max_days': max(times),
                'sample_size': len(times)
            }

        return jsonify({
            "grunnlag": calculate_response_times('grunnlag_opprettet', 'respons_grunnlag'),
            "vederlag": calculate_response_times('vederlag_krav_sendt', 'respons_vederlag'),
            "frist": calculate_response_times('frist_krav_sendt', 'respons_frist')
        })

    except Exception as e:
        logger.error(f"Analytics response-times failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@analytics_bp.route('/api/analytics/actors', methods=['GET'])
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
        all_events = _get_all_events_with_metadata()

        by_role = defaultdict(lambda: {'events': 0, 'actors': set()})
        by_actor = defaultdict(lambda: {'events': 0, 'role': None})

        for evt in all_events:
            actor = evt.get('aktor') or evt.get('actor') or 'Ukjent'
            role = evt.get('aktor_rolle') or evt.get('actorrole') or 'Ukjent'

            by_role[role]['events'] += 1
            by_role[role]['actors'].add(actor)

            by_actor[actor]['events'] += 1
            by_actor[actor]['role'] = role

        # Formater rolle-data
        role_result = {}
        for role, data in by_role.items():
            role_result[role] = {
                'events': data['events'],
                'unique_actors': len(data['actors'])
            }

        # Top aktører
        top_actors = sorted(
            [{'name': name, 'role': data['role'], 'events': data['events']}
             for name, data in by_actor.items()],
            key=lambda x: -x['events']
        )[:10]

        return jsonify({
            "by_role": role_result,
            "top_actors": top_actors
        })

    except Exception as e:
        logger.error(f"Analytics actors failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
