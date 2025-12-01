"""
Tests for utils/network.py

Network utility function tests.
"""
import pytest
import socket
from unittest.mock import patch, MagicMock
from utils.network import get_local_ip


class TestGetLocalIP:
    """Test get_local_ip() function"""

    def test_returns_ip_on_success(self):
        """Should return local IP address when socket connection succeeds"""
        # Mock socket to return a specific IP
        mock_socket = MagicMock()
        mock_socket.getsockname.return_value = ('192.168.1.100', 0)

        with patch('socket.socket', return_value=mock_socket):
            ip = get_local_ip()
            assert ip == '192.168.1.100'
            mock_socket.connect.assert_called_once_with(('8.8.8.8', 1))
            mock_socket.close.assert_called_once()

    def test_returns_localhost_on_exception(self):
        """Should return 127.0.0.1 when socket operation fails"""
        # Mock socket to raise exception
        mock_socket = MagicMock()
        mock_socket.connect.side_effect = Exception("Network error")

        with patch('socket.socket', return_value=mock_socket):
            ip = get_local_ip()
            assert ip == '127.0.0.1'
            mock_socket.close.assert_called_once()

    def test_closes_socket_on_exception(self):
        """Socket should be closed even when exception occurs"""
        mock_socket = MagicMock()
        mock_socket.getsockname.side_effect = Exception("Error")

        with patch('socket.socket', return_value=mock_socket):
            ip = get_local_ip()
            assert ip == '127.0.0.1'
            # Verify socket was closed despite exception
            mock_socket.close.assert_called_once()

    def test_uses_udp_socket(self):
        """Should create UDP socket (SOCK_DGRAM)"""
        with patch('socket.socket') as mock_socket_class:
            mock_socket = MagicMock()
            mock_socket.getsockname.return_value = ('10.0.0.1', 0)
            mock_socket_class.return_value = mock_socket

            get_local_ip()

            # Verify socket was created with correct parameters
            mock_socket_class.assert_called_once_with(socket.AF_INET, socket.SOCK_DGRAM)

    def test_connects_to_google_dns(self):
        """Should connect to Google DNS (8.8.8.8:1) to determine local IP"""
        mock_socket = MagicMock()
        mock_socket.getsockname.return_value = ('172.16.0.1', 0)

        with patch('socket.socket', return_value=mock_socket):
            get_local_ip()
            # Verify connection to Google DNS
            mock_socket.connect.assert_called_once_with(('8.8.8.8', 1))

    def test_returns_string(self):
        """Should always return a string"""
        mock_socket = MagicMock()
        mock_socket.getsockname.return_value = ('192.168.0.1', 0)

        with patch('socket.socket', return_value=mock_socket):
            ip = get_local_ip()
            assert isinstance(ip, str)

    def test_handles_socket_creation_failure(self):
        """Should handle socket creation failure gracefully"""
        with patch('socket.socket', side_effect=Exception("Socket creation failed")):
            ip = get_local_ip()
            assert ip == '127.0.0.1'

    def test_extracts_first_element_from_getsockname(self):
        """Should extract IP address from getsockname tuple"""
        mock_socket = MagicMock()
        # getsockname returns (ip, port)
        mock_socket.getsockname.return_value = ('10.20.30.40', 12345)

        with patch('socket.socket', return_value=mock_socket):
            ip = get_local_ip()
            assert ip == '10.20.30.40'

    def test_handles_none_socket_in_finally(self):
        """Should handle case where socket is None in finally block"""
        # This tests the 'if s:' check in the finally block
        with patch('socket.socket', side_effect=Exception("Immediate failure")):
            # Should not raise error even though socket was never created
            ip = get_local_ip()
            assert ip == '127.0.0.1'

    def test_typical_private_network_ips(self):
        """Test with various private network IP ranges"""
        test_ips = [
            '192.168.1.1',    # Common home network
            '10.0.0.1',       # Private class A
            '172.16.0.1',     # Private class B
            '169.254.1.1',    # Link-local
        ]

        for test_ip in test_ips:
            mock_socket = MagicMock()
            mock_socket.getsockname.return_value = (test_ip, 0)

            with patch('socket.socket', return_value=mock_socket):
                ip = get_local_ip()
                assert ip == test_ip
