"""
pytest fixtures for integration testing

Provides:
- Flask test client
- Mock system instance
- Test data fixtures
"""
import pytest
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, MagicMock
from datetime import datetime

# Import Flask app
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock CSRF protection BEFORE importing routes
from lib.auth import csrf_protection
def mock_require_csrf(f):
    """Mock CSRF decorator for testing"""
    return f
# Mock both the module-level function and the one imported by routes
csrf_protection.require_csrf = mock_require_csrf
import lib.auth
lib.auth.require_csrf = mock_require_csrf

from app import app as flask_app, KOEAutomationSystem, DataManager
from core.generated_constants import SAK_STATUS, KOE_STATUS, BH_SVAR_STATUS


@pytest.fixture
def app():
    """Create Flask app configured for testing"""
    flask_app.config.update({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,  # Disable CSRF for testing
    })
    yield flask_app


@pytest.fixture
def client(app):
    """Create Flask test client"""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create Flask CLI runner"""
    return app.test_cli_runner()


@pytest.fixture
def temp_data_dir():
    """Create temporary directory for test data"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def mock_data_manager(temp_data_dir):
    """Create real DataManager with temporary directory"""
    return DataManager(data_dir=temp_data_dir)


@pytest.fixture
def mock_catenda():
    """Create mock Catenda API client"""
    mock = MagicMock()
    mock.authenticate.return_value = True
    mock.create_comment.return_value = {'id': 'comment-123'}
    mock.upload_document.return_value = {'id': 'doc-123'}
    mock.create_document_reference.return_value = {'id': 'ref-123'}
    mock.get_topic_details.return_value = {
        'id': 'topic-123',
        'title': 'Test Topic',
        'bimsync_creation_author': {
            'user': {
                'name': 'Test User',
                'email': 'test@example.com'
            }
        },
        'bimsync_custom_fields': []
    }
    mock.get_topic_board_details.return_value = {
        'bimsync_project_id': 'project-123'
    }
    mock.get_project_details.return_value = {
        'name': 'Test Project'
    }
    mock.find_user_in_project.return_value = {
        'name': 'Test User',
        'username': 'test@example.com',
        'company': 'Test Company'
    }
    return mock


@pytest.fixture
def mock_system(mock_data_manager, mock_catenda, temp_data_dir, monkeypatch):
    """Create mock KOEAutomationSystem"""
    config = {
        'catenda_client_id': 'test-client-id',
        'catenda_client_secret': 'test-secret',
        'catenda_project_id': 'project-123',
        'catenda_library_id': 'library-123',
        'data_dir': temp_data_dir,
        'react_app_url': 'http://localhost:3000'
    }

    # Create system with mocked catenda
    system = KOEAutomationSystem(config)
    system.catenda = mock_catenda

    # Patch the global system variable directly
    monkeypatch.setattr('app.system', system)

    yield system


@pytest.fixture
def test_sak_data():
    """Sample case data for testing"""
    return {
        'catenda_topic_id': 'topic-abc-123',
        'catenda_project_id': 'project-123',
        'catenda_board_id': 'board-123',
        'sakstittel': 'Test KOE Case',
        'te_navn': 'Test Entreprenør',
        'status': SAK_STATUS['UNDER_VARSLING'],
        'byggherre': 'Test Byggherre',
        'entreprenor': 'Test Entreprenør AS',
        'prosjekt_navn': 'Test Prosjekt',
    }


@pytest.fixture
def test_sak_with_data(mock_system, test_sak_data):
    """Create a test case with full data structure"""
    sak_id = mock_system.db.create_sak(test_sak_data)

    # Get the created data
    data = mock_system.db.get_form_data(sak_id)

    return {
        'sak_id': sak_id,
        'data': data
    }


@pytest.fixture
def test_varsel_data():
    """Sample varsel form data"""
    return {
        'dato_forhold_oppdaget': '2025-11-20',
        'hovedkategori': 'Risiko',
        'underkategori': 'Grunnforhold',
        'varsel_beskrivelse': 'Test beskrivelse av forhold',
        'varsel_type': 'Uforutsett forhold',
        'varsel_konsekvens': 'Forsinkelse'
    }


@pytest.fixture
def test_koe_data():
    """Sample KOE form data"""
    return {
        'krav_vederlag': True,
        'krav_vederlag_metode': 'regning',
        'krav_vederlag_belop': '50000',
        'krav_vederlag_begrunnelse': 'Ekstra arbeid',
        'krav_produktivitetstap': False,
        'saerskilt_varsel_rigg_drift': False,
        'krav_fristforlengelse': True,
        'krav_frist_type': 'kontraktsfrist',
        'krav_frist_antall_dager': '14',
        'forsinkelse_kritisk_linje': True,
        'krav_frist_begrunnelse': 'Grunnforhold tar lenger tid'
    }


@pytest.fixture
def test_svar_data():
    """Sample BH svar form data"""
    return {
        'vederlag': {
            'varsel_for_sent': False,
            'varsel_for_sent_begrunnelse': '',
            'bh_svar_vederlag': 'godkjent_fullt',
            'bh_vederlag_metode': 'regning',
            'bh_godkjent_vederlag_belop': '50000',
            'bh_begrunnelse_vederlag': 'Kravet er rimelig'
        },
        'frist': {
            'varsel_for_sent': False,
            'varsel_for_sent_begrunnelse': '',
            'bh_svar_frist': 'godkjent_fullt',
            'bh_godkjent_frist_dager': '14',
            'bh_frist_for_spesifisering': '',
            'bh_begrunnelse_frist': 'Rimelig forlengelse'
        },
        'mote_dato': '2025-12-01',
        'mote_referat': 'Møte avholdt, enighet om krav'
    }


@pytest.fixture(autouse=True)
def mock_magic_link_manager(monkeypatch):
    """Mock MagicLinkManager globally for all tests"""
    mock_mgr_class = MagicMock()
    mock_mgr_instance = MagicMock()
    mock_mgr_instance.generate.return_value = 'test-magic-token-123'
    mock_mgr_instance.verify.return_value = (True, None, {'sak_id': 'TEST-123'})

    mock_mgr_class.return_value = mock_mgr_instance

    # Patch magic_link module
    monkeypatch.setattr('lib.auth.magic_link.MagicLinkManager', mock_mgr_class)

    return mock_mgr_instance


