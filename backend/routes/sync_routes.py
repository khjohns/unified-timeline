"""
Sync Routes - REST API for Dalux → Catenda synchronization management.

Endpoints:
- GET/POST/PATCH/DELETE /api/sync/mappings - CRUD for sync mappings
- POST /api/sync/mappings/{id}/trigger - Trigger manual sync
- GET /api/sync/mappings/{id}/progress - SSE stream for real-time progress
- GET /api/sync/mappings/{id}/history - Sync history
- POST /api/sync/validate - Validate configuration
"""
from flask import Blueprint, request, jsonify, Response
from datetime import datetime
from typing import Generator, Optional
import json
import time
import threading

from models.sync_models import DaluxCatendaSyncMapping
from repositories.sync_mapping_repository import SyncMappingRepository
from lib.auth.magic_link import require_magic_link
from lib.auth.csrf_protection import require_csrf
from lib.dalux_factory import get_dalux_client, get_dalux_api_key
from lib.catenda_factory import get_catenda_client
from utils.logger import get_logger

logger = get_logger(__name__)
sync_bp = Blueprint('sync', __name__)

# Repository instance (lazy initialization)
_sync_repo: Optional[SyncMappingRepository] = None


def get_sync_repo() -> SyncMappingRepository:
    """Get or create the sync repository singleton."""
    global _sync_repo
    if _sync_repo is None:
        _sync_repo = SyncMappingRepository()
    return _sync_repo


# Track active syncs for SSE streaming
_active_syncs: dict[str, dict] = {}
_sync_lock = threading.Lock()


# ============================================================
# CRUD ENDPOINTS
# ============================================================

@sync_bp.route('/api/sync/mappings', methods=['GET'])
@require_magic_link
def list_mappings():
    """
    List all sync mappings.

    Query params:
    - project_id: Filter by project (optional)
    - enabled_only: Only return enabled mappings (optional, default false)

    Response:
    {
        "mappings": [SyncMapping, ...]
    }
    """
    try:
        sync_repo = get_sync_repo()
        project_id = request.args.get('project_id')
        enabled_only = request.args.get('enabled_only', 'false').lower() == 'true'

        mappings = sync_repo.list_sync_mappings(
            project_id=project_id,
            enabled_only=enabled_only
        )

        return jsonify({
            'mappings': [m.model_dump(mode='json') for m in mappings]
        })

    except Exception as e:
        logger.error(f"Failed to list sync mappings: {e}")
        return jsonify({'error': str(e)}), 500


@sync_bp.route('/api/sync/mappings/<mapping_id>', methods=['GET'])
@require_magic_link
def get_mapping(mapping_id: str):
    """
    Get single sync mapping by ID.

    Response: SyncMapping or 404
    """
    try:
        sync_repo = get_sync_repo()
        mapping = sync_repo.get_sync_mapping(mapping_id)

        if not mapping:
            return jsonify({'error': 'Mapping not found'}), 404

        return jsonify(mapping.model_dump(mode='json'))

    except Exception as e:
        logger.error(f"Failed to get sync mapping {mapping_id}: {e}")
        return jsonify({'error': str(e)}), 500


@sync_bp.route('/api/sync/mappings', methods=['POST'])
@require_csrf
@require_magic_link
def create_mapping():
    """
    Create new sync mapping.

    Request:
    {
        "project_id": "internal-project-id",
        "dalux_project_id": "6070718657",
        "dalux_base_url": "https://node1.field.dalux.com/service/api/",
        "catenda_project_id": "catenda-project-id",
        "catenda_board_id": "bcf-board-id",
        "sync_enabled": true,  // optional, default true
        "sync_interval_minutes": 15  // optional, default 15
    }

    Response 201: Created SyncMapping
    Response 400: Validation errors
    """
    try:
        data = request.json or {}

        # Validate required fields
        required = ['project_id', 'dalux_project_id', 'dalux_base_url',
                    'catenda_project_id', 'catenda_board_id']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({
                'error': f'Missing required fields: {", ".join(missing)}'
            }), 400

        # Create mapping object
        mapping = DaluxCatendaSyncMapping(
            project_id=data['project_id'],
            dalux_project_id=data['dalux_project_id'],
            dalux_base_url=data['dalux_base_url'],
            catenda_project_id=data['catenda_project_id'],
            catenda_board_id=data['catenda_board_id'],
            sync_enabled=data.get('sync_enabled', True),
            sync_interval_minutes=data.get('sync_interval_minutes', 15)
        )

        # Persist
        sync_repo = get_sync_repo()
        mapping_id = sync_repo.create_sync_mapping(mapping)

        # Fetch created mapping (to get timestamps and ID)
        created = sync_repo.get_sync_mapping(mapping_id)
        if not created:
            return jsonify({'error': 'Failed to retrieve created mapping'}), 500

        logger.info(f"Created sync mapping {mapping_id}")
        return jsonify(created.model_dump(mode='json')), 201

    except Exception as e:
        logger.error(f"Failed to create sync mapping: {e}")
        return jsonify({'error': str(e)}), 500


@sync_bp.route('/api/sync/mappings/<mapping_id>', methods=['PATCH'])
@require_csrf
@require_magic_link
def update_mapping(mapping_id: str):
    """
    Update sync mapping.

    Only allows updating specific fields:
    - sync_enabled
    - sync_interval_minutes
    - catenda_board_id

    Request:
    {
        "sync_enabled": false,
        "sync_interval_minutes": 30
    }

    Response: Updated SyncMapping
    """
    try:
        data = request.json or {}

        # Only allow updating specific fields
        allowed_fields = ['sync_enabled', 'sync_interval_minutes', 'catenda_board_id']
        updates = {k: v for k, v in data.items() if k in allowed_fields}

        if not updates:
            return jsonify({'error': 'No valid fields to update'}), 400

        sync_repo = get_sync_repo()

        # Check mapping exists
        existing = sync_repo.get_sync_mapping(mapping_id)
        if not existing:
            return jsonify({'error': 'Mapping not found'}), 404

        # Update
        success = sync_repo.update_sync_mapping(mapping_id, updates)
        if not success:
            return jsonify({'error': 'Update failed'}), 500

        # Return updated mapping
        updated = sync_repo.get_sync_mapping(mapping_id)
        logger.info(f"Updated sync mapping {mapping_id}: {list(updates.keys())}")
        return jsonify(updated.model_dump(mode='json'))

    except Exception as e:
        logger.error(f"Failed to update sync mapping {mapping_id}: {e}")
        return jsonify({'error': str(e)}), 500


@sync_bp.route('/api/sync/mappings/<mapping_id>', methods=['DELETE'])
@require_csrf
@require_magic_link
def delete_mapping(mapping_id: str):
    """
    Delete sync mapping and all related records.

    Response 204: Deleted
    Response 404: Not found
    """
    try:
        sync_repo = get_sync_repo()

        # Check exists
        existing = sync_repo.get_sync_mapping(mapping_id)
        if not existing:
            return jsonify({'error': 'Mapping not found'}), 404

        # Delete
        success = sync_repo.delete_sync_mapping(mapping_id)
        if not success:
            return jsonify({'error': 'Delete failed'}), 500

        logger.info(f"Deleted sync mapping {mapping_id}")
        return '', 204

    except Exception as e:
        logger.error(f"Failed to delete sync mapping {mapping_id}: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================================
# SYNC OPERATIONS
# ============================================================

@sync_bp.route('/api/sync/mappings/<mapping_id>/trigger', methods=['POST'])
@require_csrf
@require_magic_link
def trigger_sync(mapping_id: str):
    """
    Trigger manual sync for a mapping.

    Request:
    {
        "full_sync": false  // optional, default false
    }

    Response 202:
    {
        "status": "started",
        "mapping_id": "...",
        "full_sync": false,
        "message": "..."
    }
    """
    try:
        data = request.json or {}
        full_sync = data.get('full_sync', False)

        sync_repo = get_sync_repo()

        # Check mapping exists and is enabled
        mapping = sync_repo.get_sync_mapping(mapping_id)
        if not mapping:
            return jsonify({'error': 'Mapping not found'}), 404

        if not mapping.sync_enabled:
            return jsonify({'error': 'Sync is disabled for this mapping'}), 400

        # Check if sync is already in progress
        with _sync_lock:
            if mapping_id in _active_syncs:
                return jsonify({
                    'error': 'Sync already in progress for this mapping'
                }), 409

            # Mark sync as started
            _active_syncs[mapping_id] = {
                'status': 'starting',
                'started_at': datetime.utcnow().isoformat(),
                'full_sync': full_sync,
                'events': []
            }

        # Start sync in background thread
        thread = threading.Thread(
            target=_run_sync_background,
            args=(mapping_id, full_sync),
            daemon=True
        )
        thread.start()

        logger.info(f"Triggered sync for mapping {mapping_id}, full_sync={full_sync}")

        return jsonify({
            'status': 'started',
            'mapping_id': mapping_id,
            'full_sync': full_sync,
            'message': 'Sync started. Use /api/sync/mappings/{id}/progress for real-time updates.'
        }), 202

    except Exception as e:
        logger.error(f"Failed to trigger sync for mapping {mapping_id}: {e}")
        return jsonify({'error': str(e)}), 500


def _run_sync_background(mapping_id: str, full_sync: bool):
    """Run sync in background thread and emit events."""
    try:
        from services.dalux_sync_service import DaluxSyncService

        # Get services
        sync_repo = get_sync_repo()
        mapping = sync_repo.get_sync_mapping(mapping_id)
        if not mapping:
            _emit_sync_event(mapping_id, 'error', {'error': 'Mapping not found'})
            return

        dalux_client = get_dalux_client(base_url=mapping.dalux_base_url)
        if not dalux_client:
            _emit_sync_event(mapping_id, 'error', {'error': 'Dalux not configured'})
            return

        catenda_client = get_catenda_client()
        if not catenda_client:
            _emit_sync_event(mapping_id, 'error', {'error': 'Catenda not configured'})
            return

        # Run sync
        _emit_sync_event(mapping_id, 'started', {
            'sync_mapping_id': mapping_id,
            'full_sync': full_sync
        })

        sync_service = DaluxSyncService(dalux_client, catenda_client, sync_repo)
        result = sync_service.sync_project(mapping_id, full_sync=full_sync)

        # Emit completed event
        _emit_sync_event(mapping_id, 'completed', result.model_dump(mode='json'))

    except Exception as e:
        logger.error(f"Background sync failed for {mapping_id}: {e}", exc_info=True)
        _emit_sync_event(mapping_id, 'error', {'error': str(e)})
    finally:
        # Clean up after a delay (allow SSE clients to receive final events)
        time.sleep(2)
        with _sync_lock:
            _active_syncs.pop(mapping_id, None)


def _emit_sync_event(mapping_id: str, event_type: str, data: dict):
    """Emit an event for SSE streaming."""
    with _sync_lock:
        if mapping_id in _active_syncs:
            _active_syncs[mapping_id]['events'].append({
                'type': event_type,
                'data': data,
                'timestamp': datetime.utcnow().isoformat()
            })
            _active_syncs[mapping_id]['status'] = event_type


@sync_bp.route('/api/sync/mappings/<mapping_id>/progress', methods=['GET'])
def sync_progress(mapping_id: str):
    """
    SSE stream for real-time sync progress.

    Client usage:
        const eventSource = new EventSource('/api/sync/mappings/{id}/progress');
        eventSource.onmessage = (e) => { const data = JSON.parse(e.data); ... };

    Events:
    - started: {"sync_mapping_id": "...", "full_sync": false}
    - progress: {"tasks_processed": 10, ...}
    - completed: {SyncResult}
    - error: {"error": "..."}
    """
    def generate_events() -> Generator[str, None, None]:
        """Generate SSE events."""
        last_event_index = 0

        # Initial check - is there an active sync?
        with _sync_lock:
            if mapping_id not in _active_syncs:
                yield f"data: {json.dumps({'status': 'idle', 'message': 'No active sync'})}\n\n"
                return

        # Stream events until sync completes
        while True:
            with _sync_lock:
                if mapping_id not in _active_syncs:
                    yield f"data: {json.dumps({'status': 'completed', 'message': 'Sync finished'})}\n\n"
                    break

                sync_data = _active_syncs[mapping_id]
                events = sync_data['events']

                # Send any new events
                while last_event_index < len(events):
                    event = events[last_event_index]
                    yield f"event: sync.{event['type']}\ndata: {json.dumps(event['data'])}\n\n"
                    last_event_index += 1

                # Check if final event sent
                if sync_data['status'] in ('completed', 'error'):
                    break

            # Small delay before checking again
            time.sleep(0.5)

    return Response(
        generate_events(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'  # Disable nginx buffering
        }
    )


@sync_bp.route('/api/sync/mappings/<mapping_id>/history', methods=['GET'])
@require_magic_link
def sync_history(mapping_id: str):
    """
    Get sync history (task sync records).

    Query params:
    - limit: Max records to return (default 50)
    - status: Filter by status (synced/pending/failed)

    Response:
    {
        "records": [TaskSyncRecord, ...],
        "summary": {"synced": 10, "pending": 2, "failed": 1}
    }
    """
    try:
        sync_repo = get_sync_repo()

        # Check mapping exists
        mapping = sync_repo.get_sync_mapping(mapping_id)
        if not mapping:
            return jsonify({'error': 'Mapping not found'}), 404

        limit = int(request.args.get('limit', 50))
        status = request.args.get('status')

        records = sync_repo.list_task_sync_records(mapping_id, status=status)
        records = records[:limit]

        # Calculate summary
        all_records = sync_repo.list_task_sync_records(mapping_id)
        summary = {
            'synced': len([r for r in all_records if r.sync_status == 'synced']),
            'pending': len([r for r in all_records if r.sync_status == 'pending']),
            'failed': len([r for r in all_records if r.sync_status == 'failed']),
            'total': len(all_records)
        }

        return jsonify({
            'records': [r.model_dump(mode='json') for r in records],
            'summary': summary
        })

    except Exception as e:
        logger.error(f"Failed to get sync history for {mapping_id}: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================================
# DALUX DATA ACCESS
# ============================================================

@sync_bp.route('/api/sync/mappings/<mapping_id>/tasks', methods=['GET'])
@require_magic_link
def get_mapping_tasks(mapping_id: str):
    """
    Get Dalux tasks for a mapping (preview).

    Query params:
    - limit: Max tasks to return (default 100)

    Response:
    {
        "tasks": [DaluxTask, ...],
        "total": number
    }
    """
    try:
        sync_repo = get_sync_repo()
        mapping = sync_repo.get_sync_mapping(mapping_id)

        if not mapping:
            return jsonify({'error': 'Mapping not found'}), 404

        dalux_client = get_dalux_client(base_url=mapping.dalux_base_url)
        if not dalux_client:
            return jsonify({'error': 'Dalux not configured'}), 500

        limit = int(request.args.get('limit', 100))

        tasks = dalux_client.get_tasks(
            project_id=mapping.dalux_project_id,
            limit=limit
        )

        return jsonify({
            'tasks': tasks,
            'total': len(tasks)
        })

    except Exception as e:
        logger.error(f"Failed to fetch Dalux tasks for {mapping_id}: {e}")
        return jsonify({'error': str(e)}), 500


@sync_bp.route('/api/sync/mappings/<mapping_id>/forms', methods=['GET'])
@require_magic_link
def get_mapping_forms(mapping_id: str):
    """
    Get Dalux forms for a mapping.

    Query params:
    - limit: Max forms to return (default 100)

    Response:
    {
        "forms": [DaluxForm, ...],
        "total": number
    }
    """
    try:
        sync_repo = get_sync_repo()
        mapping = sync_repo.get_sync_mapping(mapping_id)

        if not mapping:
            return jsonify({'error': 'Mapping not found'}), 404

        dalux_client = get_dalux_client(base_url=mapping.dalux_base_url)
        if not dalux_client:
            return jsonify({'error': 'Dalux not configured'}), 500

        limit = int(request.args.get('limit', 100))

        forms = dalux_client.get_forms(
            project_id=mapping.dalux_project_id,
            limit=limit
        )

        return jsonify({
            'forms': forms,
            'total': len(forms)
        })

    except Exception as e:
        logger.error(f"Failed to fetch Dalux forms for {mapping_id}: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================================
# VALIDATION
# ============================================================

@sync_bp.route('/api/sync/validate', methods=['POST'])
@require_csrf
@require_magic_link
def validate_config():
    """
    Validate Dalux/Catenda configuration without creating mapping.

    Request:
    {
        "dalux_project_id": "6070718657",
        "dalux_base_url": "https://node1.field.dalux.com/service/api/",
        "catenda_project_id": "catenda-project-id",
        "catenda_board_id": "bcf-board-id"
    }

    Response:
    {
        "valid": true,
        "dalux_ok": true,
        "catenda_ok": true,
        "errors": []
    }
    """
    try:
        data = request.json or {}
        errors = []
        dalux_ok = False
        catenda_ok = False

        # Validate Dalux connection
        dalux_base_url = data.get('dalux_base_url')
        dalux_project_id = data.get('dalux_project_id')

        if dalux_base_url and dalux_project_id:
            dalux_client = get_dalux_client(base_url=dalux_base_url)
            if dalux_client:
                try:
                    if dalux_client.health_check():
                        # Try to access the project
                        projects = dalux_client.get_projects()
                        project_ids = [p.get('data', {}).get('projectId') for p in projects]
                        if dalux_project_id in project_ids:
                            dalux_ok = True
                        else:
                            errors.append(f'Dalux project {dalux_project_id} not found or not accessible')
                    else:
                        errors.append('Dalux API key invalid')
                except Exception as e:
                    errors.append(f'Dalux connection error: {str(e)}')
            else:
                errors.append('Dalux not configured (missing DALUX_API_KEY)')
        else:
            errors.append('dalux_base_url and dalux_project_id are required')

        # Validate Catenda connection
        catenda_project_id = data.get('catenda_project_id')
        catenda_board_id = data.get('catenda_board_id')

        if catenda_project_id and catenda_board_id:
            catenda_client = get_catenda_client()
            if catenda_client:
                try:
                    # Set the board and try to list topics
                    catenda_client.topic_board_id = catenda_board_id
                    topics = catenda_client.list_topics(limit=1)
                    catenda_ok = True
                except Exception as e:
                    errors.append(f'Catenda connection error: {str(e)}')
            else:
                errors.append('Catenda not configured (missing credentials)')
        else:
            errors.append('catenda_project_id and catenda_board_id are required')

        return jsonify({
            'valid': dalux_ok and catenda_ok,
            'dalux_ok': dalux_ok,
            'catenda_ok': catenda_ok,
            'errors': errors
        })

    except Exception as e:
        logger.error(f"Validation failed: {e}")
        return jsonify({
            'valid': False,
            'dalux_ok': False,
            'catenda_ok': False,
            'errors': [str(e)]
        }), 500


# ============================================================
# TEST CONNECTION (simpler validation)
# ============================================================

@sync_bp.route('/api/sync/mappings/<mapping_id>/test', methods=['POST'])
@require_csrf
@require_magic_link
def test_connection(mapping_id: str):
    """
    Test connections for an existing mapping.

    Response:
    {
        "dalux_ok": true,
        "catenda_ok": true,
        "errors": []
    }
    """
    try:
        sync_repo = get_sync_repo()
        mapping = sync_repo.get_sync_mapping(mapping_id)

        if not mapping:
            return jsonify({'error': 'Mapping not found'}), 404

        errors = []
        dalux_ok = False
        catenda_ok = False

        # Test Dalux
        dalux_client = get_dalux_client(base_url=mapping.dalux_base_url)
        if dalux_client:
            try:
                if dalux_client.health_check():
                    dalux_ok = True
            except Exception as e:
                errors.append(f'Dalux error: {str(e)}')
        else:
            errors.append('Dalux not configured')

        # Test Catenda
        catenda_client = get_catenda_client()
        if catenda_client:
            try:
                catenda_client.topic_board_id = mapping.catenda_board_id
                catenda_client.list_topics(limit=1)
                catenda_ok = True
            except Exception as e:
                errors.append(f'Catenda error: {str(e)}')
        else:
            errors.append('Catenda not configured')

        return jsonify({
            'dalux_ok': dalux_ok,
            'catenda_ok': catenda_ok,
            'errors': errors
        })

    except Exception as e:
        logger.error(f"Test connection failed for {mapping_id}: {e}")
        return jsonify({'error': str(e)}), 500
