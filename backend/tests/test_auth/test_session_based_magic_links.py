"""
Tests for Session-Based Magic Link Authentication.

These tests verify that tokens can be used multiple times within their TTL
(session-based authentication) instead of being one-time-use.
"""
import pytest
import tempfile
from datetime import datetime, timedelta
from lib.auth.magic_link import MagicLinkManager


class TestSessionBasedMagicLinks:
    """Test session-based magic link functionality."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for token storage."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def manager(self, temp_dir):
        """Create MagicLinkManager with temporary storage."""
        return MagicLinkManager(storage_dir=temp_dir)

    def test_token_can_be_used_multiple_times_in_session_mode(self, manager):
        """Test that a token can be verified multiple times when mark_as_used=False."""
        # Generate token
        token = manager.generate(sak_id="TEST-001", email="test@example.com", ttl_hours=24)

        # First verification (session-based)
        valid1, msg1, data1 = manager.verify(token, mark_as_used=False)
        assert valid1 is True
        assert msg1 == ""
        assert data1["sak_id"] == "TEST-001"

        # Second verification (should still work)
        valid2, msg2, data2 = manager.verify(token, mark_as_used=False)
        assert valid2 is True
        assert msg2 == ""
        assert data2["sak_id"] == "TEST-001"

        # Third verification (should still work)
        valid3, msg3, data3 = manager.verify(token, mark_as_used=False)
        assert valid3 is True
        assert msg3 == ""
        assert data3["sak_id"] == "TEST-001"

    def test_token_marked_as_used_cannot_be_reused(self, manager):
        """Test that marking a token as used prevents further use."""
        # Generate token
        token = manager.generate(sak_id="TEST-002", email="test@example.com")

        # First verification with mark_as_used=True
        valid1, msg1, data1 = manager.verify(token, mark_as_used=True)
        assert valid1 is True

        # Second verification should fail (token now marked as used)
        valid2, msg2, data2 = manager.verify(token, mark_as_used=False)
        assert valid2 is False
        assert "already used" in msg2.lower()

    def test_token_updates_last_accessed_on_each_use(self, manager):
        """Test that last_accessed is updated on each verification."""
        token = manager.generate(sak_id="TEST-003", email="test@example.com")

        # First access
        manager.verify(token, mark_as_used=False)
        manager.tokens = manager._load_tokens()
        first_access = manager.tokens[token]["last_accessed"]

        # Wait a tiny bit (in real use there would be time between requests)
        import time
        time.sleep(0.01)

        # Second access
        manager.verify(token, mark_as_used=False)
        manager.tokens = manager._load_tokens()
        second_access = manager.tokens[token]["last_accessed"]

        # Timestamps should be different
        assert first_access != second_access
        assert second_access > first_access

    def test_session_mode_is_default(self, manager):
        """Test that verify() defaults to session mode (mark_as_used=False)."""
        token = manager.generate(sak_id="TEST-004", email="test@example.com")

        # Call verify without mark_as_used parameter
        valid1, _, _ = manager.verify(token)
        assert valid1 is True

        # Should be able to use again (session mode is default)
        valid2, _, _ = manager.verify(token)
        assert valid2 is True

    def test_expired_token_fails_in_session_mode(self, manager):
        """Test that expired tokens fail even in session mode."""
        # Generate token with 0 hours TTL (immediately expired)
        token = manager.generate(sak_id="TEST-005", email="test@example.com", ttl_hours=0)

        # Should fail immediately
        valid, msg, data = manager.verify(token, mark_as_used=False)
        assert valid is False
        assert "expired" in msg.lower()

    def test_revoked_token_fails_in_session_mode(self, manager):
        """Test that revoked tokens fail in session mode."""
        token = manager.generate(sak_id="TEST-006", email="test@example.com")

        # Revoke token
        manager.revoke(token)

        # Should fail even in session mode
        valid, msg, data = manager.verify(token, mark_as_used=False)
        assert valid is False
        assert "revoked" in msg.lower()

    def test_batch_operations_with_same_token(self, manager):
        """Test simulating multiple API calls with same token (real-world scenario)."""
        token = manager.generate(sak_id="TEST-007", email="te@example.com", ttl_hours=24)

        # Simulate 10 API calls in a session
        for i in range(10):
            valid, msg, data = manager.verify(token, mark_as_used=False)
            assert valid is True, f"Request {i+1} should succeed"
            assert data["sak_id"] == "TEST-007"

        # All should succeed in session mode

    def test_one_time_use_can_be_enforced_when_needed(self, manager):
        """Test that critical operations can still enforce one-time use."""
        token = manager.generate(sak_id="TEST-008", email="admin@example.com")

        # Regular session-based access works
        valid1, _, _ = manager.verify(token, mark_as_used=False)
        assert valid1 is True

        valid2, _, _ = manager.verify(token, mark_as_used=False)
        assert valid2 is True

        # Now perform critical operation with one-time enforcement
        valid3, _, _ = manager.verify(token, mark_as_used=True)
        assert valid3 is True

        # Token now consumed
        valid4, msg4, _ = manager.verify(token, mark_as_used=False)
        assert valid4 is False
        assert "already used" in msg4.lower()

    def test_token_data_remains_consistent_across_verifications(self, manager):
        """Test that token data doesn't change across multiple verifications."""
        token = manager.generate(sak_id="TEST-009", email="consistent@example.com")

        # Verify multiple times
        _, _, data1 = manager.verify(token, mark_as_used=False)
        _, _, data2 = manager.verify(token, mark_as_used=False)
        _, _, data3 = manager.verify(token, mark_as_used=False)

        # All should return same data
        assert data1 == data2 == data3
        assert data1["sak_id"] == "TEST-009"
        assert data1["email"] == "consistent@example.com"

    def test_different_tokens_are_independent(self, manager):
        """Test that session mode doesn't affect different tokens."""
        token1 = manager.generate(sak_id="TEST-010", email="user1@example.com")
        token2 = manager.generate(sak_id="TEST-011", email="user2@example.com")

        # Use token1 multiple times
        manager.verify(token1, mark_as_used=False)
        manager.verify(token1, mark_as_used=False)

        # Mark token1 as used
        manager.verify(token1, mark_as_used=True)

        # token2 should still work (independent)
        valid, _, _ = manager.verify(token2, mark_as_used=False)
        assert valid is True

        # token1 should now fail
        valid, _, _ = manager.verify(token1, mark_as_used=False)
        assert valid is False


class TestBackwardsCompatibility:
    """Test that existing code continues to work."""

    @pytest.fixture
    def manager(self):
        """Create manager with default storage."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield MagicLinkManager(storage_dir=tmpdir)

    def test_existing_verify_calls_still_work(self, manager):
        """Test that verify() without mark_as_used parameter works."""
        token = manager.generate(sak_id="TEST-BC-001", email="legacy@example.com")

        # Old-style call (no mark_as_used parameter)
        valid, msg, data = manager.verify(token)

        assert valid is True
        assert msg == ""
        assert data is not None

    def test_default_behavior_is_session_based(self, manager):
        """Test that default behavior allows multiple uses (session-based)."""
        token = manager.generate(sak_id="TEST-BC-002", email="default@example.com")

        # Multiple calls without mark_as_used (should all succeed)
        for _ in range(5):
            valid, _, _ = manager.verify(token)
            assert valid is True
