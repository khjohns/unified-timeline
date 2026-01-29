"""
Comprehensive tests for lib/monitoring/audit.py

Tests cover:
- AuditLogger initialization and file creation
- log_event() with various parameters
- IP address extraction from request headers
- User-Agent extraction
- Convenience methods (auth, access, webhook, security)
- search_audit_log() utility function
- Error handling and edge cases
"""

import pytest
import json
from unittest.mock import MagicMock, patch
from datetime import datetime

from lib.monitoring.audit import (
    AuditLogger,
    search_audit_log,
    audit
)


class TestAuditLoggerInitialization:
    """Tests for AuditLogger initialization and setup."""

    def test_init_with_default_log_file(self, tmp_path):
        """Test initialization with default log file."""
        log_file = tmp_path / "audit.log"
        logger = AuditLogger(str(log_file))

        assert logger.log_file == str(log_file)
        assert log_file.exists()

    def test_init_creates_log_file_if_not_exists(self, tmp_path):
        """Test that log file is created if it doesn't exist."""
        log_file = tmp_path / "new_audit.log"
        assert not log_file.exists()

        logger = AuditLogger(str(log_file))

        assert log_file.exists()
        assert logger.log_file == str(log_file)

    def test_init_with_existing_log_file(self, tmp_path):
        """Test initialization with existing log file doesn't overwrite."""
        log_file = tmp_path / "existing.log"
        log_file.write_text("existing content\n")

        logger = AuditLogger(str(log_file))

        assert log_file.exists()
        assert log_file.read_text() == "existing content\n"

    def test_global_audit_instance_exists(self):
        """Test that global audit instance is available."""
        assert audit is not None
        assert isinstance(audit, AuditLogger)


class TestLogEvent:
    """Tests for AuditLogger.log_event() method."""

    @pytest.fixture
    def logger(self, tmp_path):
        """Create AuditLogger with temporary log file."""
        log_file = tmp_path / "test_audit.log"
        return AuditLogger(str(log_file))

    @pytest.fixture
    def mock_request(self):
        """Mock Flask request for testing."""
        mock_req = MagicMock()
        mock_req.remote_addr = "192.168.1.100"
        mock_req.headers.get.side_effect = lambda key: {
            'User-Agent': 'Mozilla/5.0 Test Browser',
            'X-Forwarded-For': None,
            'X-Real-IP': None
        }.get(key)
        return mock_req

    def test_log_event_with_all_parameters(self, logger, mock_request):
        """Test logging event with all parameters."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_event(
                event_type="access",
                user="test@example.com",
                resource="case:ABC123",
                action="read",
                result="success",
                details={"project_id": "550e8400"}
            )

        # Verify log entry was written
        with open(logger.log_file, 'r') as f:
            line = f.readline()
            entry = json.loads(line)

        assert entry['event_type'] == "access"
        assert entry['user'] == "test@example.com"
        assert entry['resource'] == "case:ABC123"
        assert entry['action'] == "read"
        assert entry['result'] == "success"
        assert entry['details'] == {"project_id": "550e8400"}
        assert entry['ip'] == "192.168.1.100"
        assert entry['user_agent'] == "Mozilla/5.0 Test Browser"
        assert 'timestamp' in entry

    def test_log_event_without_details(self, logger, mock_request):
        """Test logging event without optional details."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_event(
                event_type="auth",
                user="user@example.com",
                resource="auth:token",
                action="validate",
                result="success"
            )

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['details'] == {}
        assert entry['event_type'] == "auth"

    def test_log_event_timestamp_format(self, logger, mock_request):
        """Test that timestamp is in ISO format with Z suffix."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_event(
                event_type="test",
                user="test",
                resource="test:123",
                action="test",
                result="success"
            )

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        # Timestamp should be ISO format with Z suffix
        assert entry['timestamp'].endswith('Z')
        # Verify it's parseable as datetime
        datetime.fromisoformat(entry['timestamp'].replace('Z', '+00:00'))

    def test_log_event_json_lines_format(self, logger, mock_request):
        """Test that multiple events are logged in JSON Lines format."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_event("test", "user1", "res1", "action1", "success")
            logger.log_event("test", "user2", "res2", "action2", "denied")
            logger.log_event("test", "user3", "res3", "action3", "error")

        with open(logger.log_file, 'r') as f:
            lines = f.readlines()

        assert len(lines) == 3
        # Each line should be valid JSON
        for line in lines:
            entry = json.loads(line)
            assert 'event_type' in entry
            assert 'user' in entry

    def test_log_event_handles_file_write_error(self, logger, mock_request, capsys):
        """Test that file write errors are handled gracefully."""
        # Mock open() to raise an exception
        with patch('lib.monitoring.audit.request', mock_request):
            with patch('builtins.open', side_effect=OSError("Permission denied")):
                logger.log_event(
                    event_type="test",
                    user="test",
                    resource="test:123",
                    action="test",
                    result="success"
                )

        # Check that error was printed to stdout (fallback)
        captured = capsys.readouterr()
        assert "Audit log error" in captured.out

    def test_log_event_with_unicode_content(self, logger, mock_request):
        """Test logging with Unicode characters."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_event(
                event_type="access",
                user="ødegård@example.com",
                resource="case:ÆØÅ-123",
                action="read",
                result="success",
                details={"comment": "Grunnforhold avviker fra prosjektert"}
            )

        with open(logger.log_file, 'r', encoding='utf-8') as f:
            entry = json.loads(f.readline())

        assert entry['user'] == "ødegård@example.com"
        assert entry['resource'] == "case:ÆØÅ-123"
        assert "Grunnforhold" in entry['details']['comment']


class TestIPExtraction:
    """Tests for _get_client_ip() method."""

    @pytest.fixture
    def logger(self, tmp_path):
        """Create AuditLogger instance."""
        log_file = tmp_path / "test.log"
        return AuditLogger(str(log_file))

    def test_get_client_ip_from_x_forwarded_for_single(self, logger):
        """Test extracting IP from X-Forwarded-For header (single IP)."""
        mock_request = MagicMock()
        mock_request.headers.get.side_effect = lambda key: {
            'X-Forwarded-For': '203.0.113.42'
        }.get(key)

        with patch('lib.monitoring.audit.request', mock_request):
            ip = logger._get_client_ip()

        assert ip == '203.0.113.42'

    def test_get_client_ip_from_x_forwarded_for_multiple(self, logger):
        """Test extracting first IP from X-Forwarded-For with multiple IPs."""
        mock_request = MagicMock()
        mock_request.headers.get.side_effect = lambda key: {
            'X-Forwarded-For': '203.0.113.42, 198.51.100.17, 192.0.2.1'
        }.get(key)

        with patch('lib.monitoring.audit.request', mock_request):
            ip = logger._get_client_ip()

        assert ip == '203.0.113.42'

    def test_get_client_ip_from_x_real_ip(self, logger):
        """Test extracting IP from X-Real-IP header (nginx)."""
        mock_request = MagicMock()
        mock_request.headers.get.side_effect = lambda key: {
            'X-Forwarded-For': None,
            'X-Real-IP': '198.51.100.99'
        }.get(key)

        with patch('lib.monitoring.audit.request', mock_request):
            ip = logger._get_client_ip()

        assert ip == '198.51.100.99'

    def test_get_client_ip_from_remote_addr(self, logger):
        """Test fallback to remote_addr for direct connection."""
        mock_request = MagicMock()
        mock_request.headers.get.return_value = None
        mock_request.remote_addr = '192.168.1.123'

        with patch('lib.monitoring.audit.request', mock_request):
            ip = logger._get_client_ip()

        assert ip == '192.168.1.123'

    def test_get_client_ip_no_request_context(self, logger):
        """Test IP extraction when no request context available."""
        # Mock request.headers.get to raise RuntimeError (simulating no request context)
        mock_request = MagicMock()
        mock_request.headers.get.side_effect = RuntimeError("Working outside of request context")

        with patch('lib.monitoring.audit.request', mock_request):
            ip = logger._get_client_ip()

        assert ip is None

    def test_get_client_ip_x_forwarded_for_with_spaces(self, logger):
        """Test handling X-Forwarded-For with extra whitespace."""
        mock_request = MagicMock()
        mock_request.headers.get.side_effect = lambda key: {
            'X-Forwarded-For': '  203.0.113.42  ,  198.51.100.17  '
        }.get(key)

        with patch('lib.monitoring.audit.request', mock_request):
            ip = logger._get_client_ip()

        assert ip == '203.0.113.42'


class TestUserAgentExtraction:
    """Tests for _get_user_agent() method."""

    @pytest.fixture
    def logger(self, tmp_path):
        """Create AuditLogger instance."""
        log_file = tmp_path / "test.log"
        return AuditLogger(str(log_file))

    def test_get_user_agent_success(self, logger):
        """Test extracting User-Agent from request."""
        mock_request = MagicMock()
        mock_request.headers.get.return_value = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'

        with patch('lib.monitoring.audit.request', mock_request):
            ua = logger._get_user_agent()

        assert ua == 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'

    def test_get_user_agent_missing(self, logger):
        """Test when User-Agent header is missing."""
        mock_request = MagicMock()
        mock_request.headers.get.return_value = None

        with patch('lib.monitoring.audit.request', mock_request):
            ua = logger._get_user_agent()

        assert ua is None

    def test_get_user_agent_no_request_context(self, logger):
        """Test User-Agent extraction when no request context."""
        # Mock request.headers.get to raise RuntimeError (simulating no request context)
        mock_request = MagicMock()
        mock_request.headers.get.side_effect = RuntimeError("Working outside of request context")

        with patch('lib.monitoring.audit.request', mock_request):
            ua = logger._get_user_agent()

        assert ua is None


class TestConvenienceMethods:
    """Tests for convenience logging methods."""

    @pytest.fixture
    def logger(self, tmp_path):
        """Create AuditLogger with temporary log file."""
        log_file = tmp_path / "test_audit.log"
        return AuditLogger(str(log_file))

    @pytest.fixture
    def mock_request(self):
        """Mock Flask request."""
        mock_req = MagicMock()
        mock_req.remote_addr = "192.168.1.100"
        mock_req.headers.get.return_value = None
        return mock_req

    def test_log_auth_success(self, logger, mock_request):
        """Test log_auth_success convenience method."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_auth_success("user@example.com", {"role": "admin"})

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['event_type'] == "auth"
        assert entry['user'] == "user@example.com"
        assert entry['resource'] == "auth:token"
        assert entry['action'] == "validate"
        assert entry['result'] == "success"
        assert entry['details'] == {"role": "admin"}

    def test_log_auth_success_without_details(self, logger, mock_request):
        """Test log_auth_success without optional details."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_auth_success("user@example.com")

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['user'] == "user@example.com"
        assert entry['result'] == "success"

    def test_log_auth_failure(self, logger, mock_request):
        """Test log_auth_failure convenience method."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_auth_failure("Invalid token")

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['event_type'] == "auth"
        assert entry['user'] == "anonymous"
        assert entry['resource'] == "auth:token"
        assert entry['action'] == "validate"
        assert entry['result'] == "denied"
        assert entry['details']['reason'] == "Invalid token"

    def test_log_auth_failure_with_details(self, logger, mock_request):
        """Test log_auth_failure with additional details."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_auth_failure("Expired", {"token_age": "2h"})

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['details']['reason'] == "Expired"
        assert entry['details']['token_age'] == "2h"

    def test_log_access_denied(self, logger, mock_request):
        """Test log_access_denied convenience method."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_access_denied(
                user="user@example.com",
                resource="case:ABC123",
                reason="Insufficient permissions"
            )

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['event_type'] == "access"
        assert entry['user'] == "user@example.com"
        assert entry['resource'] == "case:ABC123"
        assert entry['action'] == "access"
        assert entry['result'] == "denied"
        assert entry['details']['reason'] == "Insufficient permissions"

    def test_log_webhook_received(self, logger, mock_request):
        """Test log_webhook_received convenience method."""
        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_webhook_received(
                event_type="TopicCreated",
                event_id="evt-123-456"
            )

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['event_type'] == "webhook"
        assert entry['user'] == "catenda"
        assert entry['resource'] == "webhook:catenda"
        assert entry['action'] == "received"
        assert entry['result'] == "success"
        assert entry['details']['event_type'] == "TopicCreated"
        assert entry['details']['event_id'] == "evt-123-456"

    def test_log_security_event(self, logger, mock_request):
        """Test log_security_event convenience method."""
        with patch('lib.monitoring.audit.request', mock_request):
            with patch('lib.monitoring.audit.g', MagicMock(get=lambda x, default: {'email': 'attacker@example.com'})):
                logger.log_security_event(
                    threat_type="csrf_fail",
                    details={"endpoint": "/api/save"}
                )

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['event_type'] == "security"
        assert entry['user'] == "attacker@example.com"
        assert entry['resource'] == "security"
        assert entry['action'] == "csrf_fail"
        assert entry['result'] == "blocked"
        assert entry['details']['endpoint'] == "/api/save"

    def test_log_security_event_anonymous_user(self, logger, mock_request):
        """Test log_security_event with anonymous user."""
        with patch('lib.monitoring.audit.request', mock_request):
            with patch('lib.monitoring.audit.g', MagicMock(get=lambda x, default: default)):
                logger.log_security_event("rate_limit_exceeded")

        with open(logger.log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['user'] == "anonymous"


class TestSearchAuditLog:
    """Tests for search_audit_log() utility function."""

    @pytest.fixture
    def populated_log(self, tmp_path):
        """Create log file with test entries."""
        log_file = tmp_path / "search_test.log"
        logger = AuditLogger(str(log_file))

        mock_request = MagicMock()
        mock_request.remote_addr = "192.168.1.100"
        mock_request.headers.get.return_value = None

        with patch('lib.monitoring.audit.request', mock_request):
            # Add various test entries
            logger.log_event("auth", "user1@example.com", "auth:token", "login", "success")
            logger.log_event("auth", "user2@example.com", "auth:token", "login", "denied")
            logger.log_event("access", "user1@example.com", "case:ABC123", "read", "success")
            logger.log_event("access", "user3@example.com", "case:XYZ789", "read", "denied")
            logger.log_event("modify", "user1@example.com", "case:ABC123", "update", "success")
            logger.log_event("webhook", "catenda", "webhook:catenda", "received", "success")

        return str(log_file)

    def test_search_audit_log_no_filters(self, populated_log):
        """Test searching without filters returns all entries."""
        results = search_audit_log(populated_log, limit=100)
        assert len(results) == 6

    def test_search_audit_log_filter_by_event_type(self, populated_log):
        """Test filtering by event_type."""
        results = search_audit_log(populated_log, event_type="auth")
        assert len(results) == 2
        assert all(r['event_type'] == 'auth' for r in results)

    def test_search_audit_log_filter_by_user(self, populated_log):
        """Test filtering by user."""
        results = search_audit_log(populated_log, user="user1@example.com")
        assert len(results) == 3
        assert all(r['user'] == 'user1@example.com' for r in results)

    def test_search_audit_log_filter_by_result(self, populated_log):
        """Test filtering by result."""
        results = search_audit_log(populated_log, result="denied")
        assert len(results) == 2
        assert all(r['result'] == 'denied' for r in results)

    def test_search_audit_log_multiple_filters(self, populated_log):
        """Test combining multiple filters."""
        results = search_audit_log(
            populated_log,
            event_type="access",
            result="success"
        )
        assert len(results) == 1
        assert results[0]['event_type'] == 'access'
        assert results[0]['result'] == 'success'

    def test_search_audit_log_with_limit(self, populated_log):
        """Test that limit parameter works."""
        results = search_audit_log(populated_log, limit=3)
        assert len(results) == 3

    def test_search_audit_log_nonexistent_file(self, tmp_path):
        """Test searching non-existent log file returns empty list."""
        results = search_audit_log(str(tmp_path / "nonexistent.log"))
        assert results == []

    def test_search_audit_log_with_malformed_json(self, tmp_path):
        """Test that malformed JSON lines are skipped."""
        log_file = tmp_path / "malformed.log"

        # Create log with mix of valid and invalid JSON
        with open(log_file, 'w') as f:
            f.write('{"event_type": "test", "user": "valid1"}\n')
            f.write('this is not json\n')
            f.write('{"event_type": "test", "user": "valid2"}\n')
            f.write('{incomplete json\n')
            f.write('{"event_type": "test", "user": "valid3"}\n')

        results = search_audit_log(str(log_file))

        # Should only return the 3 valid entries
        assert len(results) == 3
        assert results[0]['user'] == 'valid1'
        assert results[1]['user'] == 'valid2'
        assert results[2]['user'] == 'valid3'

    def test_search_audit_log_no_matches(self, populated_log):
        """Test searching with filter that matches nothing."""
        results = search_audit_log(populated_log, user="nonexistent@example.com")
        assert results == []


class TestEdgeCases:
    """Tests for edge cases and error scenarios."""

    def test_log_event_with_empty_details(self, tmp_path):
        """Test logging with explicitly empty details dict."""
        log_file = tmp_path / "test.log"
        logger = AuditLogger(str(log_file))

        mock_request = MagicMock()
        mock_request.remote_addr = "127.0.0.1"
        mock_request.headers.get.return_value = None

        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_event(
                event_type="test",
                user="test",
                resource="test:123",
                action="test",
                result="success",
                details={}
            )

        with open(log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['details'] == {}

    def test_log_event_with_complex_details(self, tmp_path):
        """Test logging with nested/complex details."""
        log_file = tmp_path / "test.log"
        logger = AuditLogger(str(log_file))

        mock_request = MagicMock()
        mock_request.remote_addr = "127.0.0.1"
        mock_request.headers.get.return_value = None

        complex_details = {
            "nested": {"key": "value", "number": 42},
            "list": [1, 2, 3],
            "bool": True,
            "null": None
        }

        with patch('lib.monitoring.audit.request', mock_request):
            logger.log_event(
                event_type="test",
                user="test",
                resource="test:123",
                action="test",
                result="success",
                details=complex_details
            )

        with open(log_file, 'r') as f:
            entry = json.loads(f.readline())

        assert entry['details'] == complex_details
