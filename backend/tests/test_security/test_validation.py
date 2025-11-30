"""
Comprehensive tests for lib/security/validation.py

Tests cover:
- ValidationError exception
- validate_guid() - GUID/UUID validation with security checks
- validate_csv_safe_string() - CSV injection protection
- validate_email() - Email format validation
- validate_topic_status() - BCF topic status validation
- validate_sak_status() - Internal workflow status validation
- validate_positive_number() - Positive number validation
- validate_date_string() - Date format validation
- Security scenarios (injection, path traversal, etc.)
"""

import pytest

from lib.security.validation import (
    ValidationError,
    validate_guid,
    validate_csv_safe_string,
    validate_email,
    validate_topic_status,
    validate_sak_status,
    validate_positive_number,
    validate_date_string
)


class TestValidationError:
    """Tests for ValidationError exception."""

    def test_validation_error_creation(self):
        """Test creating ValidationError with field and message."""
        error = ValidationError("email", "Invalid format")

        assert error.field == "email"
        assert error.message == "Invalid format"
        assert str(error) == "Validation error in 'email': Invalid format"

    def test_validation_error_can_be_caught(self):
        """Test that ValidationError can be caught and handled."""
        with pytest.raises(ValidationError) as exc_info:
            raise ValidationError("field", "message")

        assert exc_info.value.field == "field"
        assert exc_info.value.message == "message"


class TestValidateGuid:
    """Tests for validate_guid() function."""

    def test_validate_guid_compacted_format(self):
        """Test validating compacted UUID (32 hex chars)."""
        result = validate_guid("18d0273de15c492497b36f47b233eebe")
        assert result == "18d0273de15c492497b36f47b233eebe"

    def test_validate_guid_standard_format(self):
        """Test validating standard UUID format (36 chars with dashes)."""
        result = validate_guid("18d0273d-e15c-4924-97b3-6f47b233eebe")
        assert result == "18d0273d-e15c-4924-97b3-6f47b233eebe"

    def test_validate_guid_uppercase_converted_to_lowercase(self):
        """Test that uppercase GUID is converted to lowercase."""
        result = validate_guid("18D0273DE15C492497B36F47B233EEBE")
        assert result == "18d0273de15c492497b36f47b233eebe"

    def test_validate_guid_mixed_case_with_dashes(self):
        """Test mixed case UUID with dashes."""
        result = validate_guid("18D0273d-E15c-4924-97B3-6f47b233eebe")
        assert result == "18d0273d-e15c-4924-97b3-6f47b233eebe"

    def test_validate_guid_empty_string(self):
        """Test that empty GUID is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_guid("")

        assert exc_info.value.field == "guid"
        assert "Cannot be empty" in exc_info.value.message

    def test_validate_guid_not_string(self):
        """Test that non-string GUID is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_guid(12345)

        assert exc_info.value.field == "guid"
        assert "Must be string" in exc_info.value.message

    def test_validate_guid_invalid_characters(self):
        """Test that GUID with invalid characters is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_guid("zzz0273de15c492497b36f47b233eebe")

        assert "Invalid UUID format" in exc_info.value.message

    def test_validate_guid_too_short(self):
        """Test that too short GUID is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_guid("18d0273de15c49")

        assert "Invalid UUID format" in exc_info.value.message

    def test_validate_guid_too_long(self):
        """Test that too long GUID is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_guid("18d0273de15c492497b36f47b233eebe-extra")

        assert "Invalid UUID format" in exc_info.value.message

    def test_validate_guid_path_traversal_attack(self):
        """Test that path traversal attempts are blocked."""
        with pytest.raises(ValidationError) as exc_info:
            validate_guid("../../etc/passwd")

        # This fails at regex check (not hex chars), not path traversal check
        assert "Invalid UUID format" in exc_info.value.message

    def test_validate_guid_forward_slash(self):
        """Test that forward slash is blocked (directory separator)."""
        with pytest.raises(ValidationError) as exc_info:
            validate_guid("18d0273d/e15c/4924/97b3/6f47b233eebe")

        # This fails at regex check (/ not allowed in hex), not path traversal check
        assert "Invalid UUID format" in exc_info.value.message

    def test_validate_guid_backslash(self):
        """Test that backslash is blocked (Windows path separator)."""
        with pytest.raises(ValidationError) as exc_info:
            validate_guid("18d0273d\\e15c\\4924\\97b3\\6f47b233eebe")

        # This fails at regex check (\ not allowed in hex), not path traversal check
        assert "Invalid UUID format" in exc_info.value.message

    def test_validate_guid_custom_field_name(self):
        """Test that custom field name is used in error messages."""
        with pytest.raises(ValidationError) as exc_info:
            validate_guid("invalid", "topic_id")

        assert exc_info.value.field == "topic_id"


class TestValidateCsvSafeString:
    """Tests for validate_csv_safe_string() function."""

    def test_validate_csv_safe_string_normal_text(self):
        """Test validating normal, safe text."""
        result = validate_csv_safe_string("Normal text content", "title")
        assert result == "Normal text content"

    def test_validate_csv_safe_string_with_norwegian_characters(self):
        """Test validating text with Norwegian characters (æøå)."""
        result = validate_csv_safe_string("Grunnforhold avviker fra prosjektert", "description")
        assert result == "Grunnforhold avviker fra prosjektert"

    def test_validate_csv_safe_string_strips_whitespace(self):
        """Test that leading/trailing whitespace is stripped."""
        result = validate_csv_safe_string("  text with spaces  ", "title")
        assert result == "text with spaces"

    def test_validate_csv_safe_string_removes_control_chars(self):
        """Test that control characters are removed."""
        result = validate_csv_safe_string("text\x00with\x01control\x02chars", "title")
        assert result == "textwithcontrolchars"

    def test_validate_csv_safe_string_not_string(self):
        """Test that non-string input is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_csv_safe_string(12345, "title")

        assert "Must be string" in exc_info.value.message

    def test_validate_csv_safe_string_exceeds_max_length(self):
        """Test that too long strings are rejected."""
        long_text = "a" * 501

        with pytest.raises(ValidationError) as exc_info:
            validate_csv_safe_string(long_text, "title", max_length=500)

        assert "Exceeds maximum length" in exc_info.value.message
        assert "500" in exc_info.value.message

    def test_validate_csv_safe_string_custom_max_length(self):
        """Test custom max_length parameter."""
        result = validate_csv_safe_string("Short text", "title", max_length=50)
        assert result == "Short text"

        with pytest.raises(ValidationError):
            validate_csv_safe_string("a" * 51, "title", max_length=50)

    def test_validate_csv_safe_string_equals_injection(self):
        """Test that CSV formula injection with = is blocked."""
        with pytest.raises(ValidationError) as exc_info:
            validate_csv_safe_string("=1+1", "formula")

        assert "CSV injection" in exc_info.value.message

    def test_validate_csv_safe_string_plus_injection(self):
        """Test that CSV formula injection with + is blocked."""
        with pytest.raises(ValidationError) as exc_info:
            validate_csv_safe_string("+1+1", "formula")

        assert "CSV injection" in exc_info.value.message

    def test_validate_csv_safe_string_minus_injection(self):
        """Test that CSV formula injection with - is blocked."""
        with pytest.raises(ValidationError) as exc_info:
            validate_csv_safe_string("-1-1", "formula")

        assert "CSV injection" in exc_info.value.message

    def test_validate_csv_safe_string_at_injection(self):
        """Test that CSV formula injection with @ is blocked."""
        with pytest.raises(ValidationError) as exc_info:
            validate_csv_safe_string("@SUM(A1:A10)", "formula")

        assert "CSV injection" in exc_info.value.message

    def test_validate_csv_safe_string_control_chars_removed(self):
        """Test that tab and carriage return control chars are removed."""
        # Tab and \r are control chars (ASCII < 32) and are removed before injection check
        result = validate_csv_safe_string("\tformula", "test")
        assert result == "formula"

        result = validate_csv_safe_string("\rformula", "test")
        assert result == "formula"

    def test_validate_csv_safe_string_allow_newlines_true(self):
        """Test that newlines are preserved when allow_newlines=True."""
        result = validate_csv_safe_string("Line 1\nLine 2\nLine 3", "description", allow_newlines=True)
        assert result == "Line 1\nLine 2\nLine 3"

    def test_validate_csv_safe_string_allow_newlines_false(self):
        """Test that newlines are removed when allow_newlines=False."""
        # Note: newlines are removed by control char filter (line 155), not replaced
        result = validate_csv_safe_string("Line 1\nLine 2\nLine 3", "description", allow_newlines=False)
        assert result == "Line 1Line 2Line 3"

    def test_validate_csv_safe_string_safe_after_trim(self):
        """Test that string is safe after whitespace trim."""
        # Leading spaces before = should be trimmed, making it unsafe
        with pytest.raises(ValidationError) as exc_info:
            validate_csv_safe_string("  =formula", "test")

        assert "CSV injection" in exc_info.value.message


class TestValidateEmail:
    """Tests for validate_email() function."""

    def test_validate_email_simple(self):
        """Test validating simple email address."""
        result = validate_email("user@example.com")
        assert result == "user@example.com"

    def test_validate_email_with_subdomain(self):
        """Test validating email with subdomain."""
        result = validate_email("user@mail.example.com")
        assert result == "user@mail.example.com"

    def test_validate_email_with_plus(self):
        """Test validating email with + sign (Gmail alias)."""
        result = validate_email("user+tag@example.com")
        assert result == "user+tag@example.com"

    def test_validate_email_with_dots(self):
        """Test validating email with dots in username."""
        result = validate_email("first.last@example.com")
        assert result == "first.last@example.com"

    def test_validate_email_with_numbers(self):
        """Test validating email with numbers."""
        result = validate_email("user123@example456.com")
        assert result == "user123@example456.com"

    def test_validate_email_uppercase_converted_to_lowercase(self):
        """Test that uppercase email is converted to lowercase."""
        result = validate_email("USER@EXAMPLE.COM")
        assert result == "user@example.com"

    def test_validate_email_strips_whitespace(self):
        """Test that leading/trailing whitespace is stripped."""
        result = validate_email("  user@example.com  ")
        assert result == "user@example.com"

    def test_validate_email_not_string(self):
        """Test that non-string email is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_email(12345)

        assert "Must be string" in exc_info.value.message

    def test_validate_email_empty_string(self):
        """Test that empty email is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_email("")

        assert "Cannot be empty" in exc_info.value.message

    def test_validate_email_missing_at_sign(self):
        """Test that email without @ is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_email("userexample.com")

        assert "Invalid email format" in exc_info.value.message

    def test_validate_email_missing_domain(self):
        """Test that email without domain is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_email("user@")

        assert "Invalid email format" in exc_info.value.message

    def test_validate_email_missing_username(self):
        """Test that email without username is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_email("@example.com")

        assert "Invalid email format" in exc_info.value.message

    def test_validate_email_missing_tld(self):
        """Test that email without TLD is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_email("user@example")

        assert "Invalid email format" in exc_info.value.message

    def test_validate_email_invalid_characters(self):
        """Test that email with invalid characters is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_email("user name@example.com")  # Space

        assert "Invalid email format" in exc_info.value.message

    def test_validate_email_custom_field_name(self):
        """Test that custom field name is used in error messages."""
        with pytest.raises(ValidationError) as exc_info:
            validate_email("invalid", "user_email")

        assert exc_info.value.field == "user_email"


class TestValidateTopicStatus:
    """Tests for validate_topic_status() function."""

    def test_validate_topic_status_draft(self):
        """Test validating 'Draft' status."""
        result = validate_topic_status("Draft")
        assert result == "Draft"

    def test_validate_topic_status_open(self):
        """Test validating 'Open' status."""
        result = validate_topic_status("Open")
        assert result == "Open"

    def test_validate_topic_status_active(self):
        """Test validating 'Active' status."""
        result = validate_topic_status("Active")
        assert result == "Active"

    def test_validate_topic_status_resolved(self):
        """Test validating 'Resolved' status."""
        result = validate_topic_status("Resolved")
        assert result == "Resolved"

    def test_validate_topic_status_closed(self):
        """Test validating 'Closed' status."""
        result = validate_topic_status("Closed")
        assert result == "Closed"

    def test_validate_topic_status_strips_whitespace(self):
        """Test that whitespace is stripped."""
        result = validate_topic_status("  Draft  ")
        assert result == "Draft"

    def test_validate_topic_status_not_string(self):
        """Test that non-string status is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_topic_status(123)

        assert "Must be string" in exc_info.value.message

    def test_validate_topic_status_invalid_status(self):
        """Test that invalid status is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_topic_status("InvalidStatus")

        assert "Must be one of" in exc_info.value.message
        assert "Draft" in exc_info.value.message
        assert "Open" in exc_info.value.message

    def test_validate_topic_status_case_sensitive(self):
        """Test that status validation is case-sensitive."""
        with pytest.raises(ValidationError):
            validate_topic_status("draft")  # lowercase should fail


class TestValidateSakStatus:
    """Tests for validate_sak_status() function."""

    def test_validate_sak_status_under_varsling(self):
        """Test validating 'Under varsling' status (100000000)."""
        result = validate_sak_status("100000000")
        assert result == "100000000"

    def test_validate_sak_status_varslet(self):
        """Test validating 'Varslet' status (100000001)."""
        result = validate_sak_status("100000001")
        assert result == "100000001"

    def test_validate_sak_status_venter_pa_svar(self):
        """Test validating 'Venter på svar' status (100000002)."""
        result = validate_sak_status("100000002")
        assert result == "100000002"

    def test_validate_sak_status_empty_string(self):
        """Test validating empty status (initial state)."""
        result = validate_sak_status("")
        assert result == ""

    def test_validate_sak_status_all_valid_statuses(self):
        """Test all valid sak statuses."""
        valid_statuses = [
            '100000000', '100000001', '100000002', '100000003',
            '100000005', '100000006', '100000007', '100000008',
            '100000009', '100000011', '100000012', '100000013', ''
        ]

        for status in valid_statuses:
            result = validate_sak_status(status)
            assert result == status

    def test_validate_sak_status_not_string(self):
        """Test that non-string status is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_sak_status(100000000)  # Integer

        assert "Must be string" in exc_info.value.message

    def test_validate_sak_status_invalid_code(self):
        """Test that invalid status code is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_sak_status("999999999")

        assert "Invalid status code" in exc_info.value.message


class TestValidatePositiveNumber:
    """Tests for validate_positive_number() function."""

    def test_validate_positive_number_integer(self):
        """Test validating positive integer."""
        result = validate_positive_number("123", "amount")
        assert result == 123.0

    def test_validate_positive_number_float(self):
        """Test validating positive float."""
        result = validate_positive_number("123.45", "amount")
        assert result == 123.45

    def test_validate_positive_number_zero_allowed(self):
        """Test that zero is allowed when allow_zero=True."""
        result = validate_positive_number("0", "amount", allow_zero=True)
        assert result == 0.0

    def test_validate_positive_number_zero_not_allowed(self):
        """Test that zero is rejected when allow_zero=False."""
        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number("0", "amount", allow_zero=False)

        assert "Cannot be zero" in exc_info.value.message

    def test_validate_positive_number_negative_rejected(self):
        """Test that negative numbers are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number("-100", "amount")

        assert "Must be positive" in exc_info.value.message

    def test_validate_positive_number_with_max_value(self):
        """Test max_value parameter."""
        result = validate_positive_number("100", "amount", max_value=1000)
        assert result == 100.0

        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number("1001", "amount", max_value=1000)

        assert "Exceeds maximum value" in exc_info.value.message
        assert "1000" in exc_info.value.message

    def test_validate_positive_number_not_a_number(self):
        """Test that non-numeric strings are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number("not-a-number", "amount")

        assert "Must be a number" in exc_info.value.message

    def test_validate_positive_number_none(self):
        """Test that None is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number(None, "amount")

        assert "Must be a number" in exc_info.value.message

    def test_validate_positive_number_from_int(self):
        """Test validating from actual int (not string)."""
        result = validate_positive_number(42, "count")
        assert result == 42.0

    def test_validate_positive_number_from_float(self):
        """Test validating from actual float (not string)."""
        result = validate_positive_number(42.5, "count")
        assert result == 42.5


class TestValidateDateString:
    """Tests for validate_date_string() function."""

    def test_validate_date_string_valid_date(self):
        """Test validating valid date string."""
        result = validate_date_string("2025-11-24")
        assert result == "2025-11-24"

    def test_validate_date_string_first_of_month(self):
        """Test validating first day of month."""
        result = validate_date_string("2025-01-01")
        assert result == "2025-01-01"

    def test_validate_date_string_end_of_month(self):
        """Test validating last day of month."""
        result = validate_date_string("2025-12-31")
        assert result == "2025-12-31"

    def test_validate_date_string_strips_whitespace(self):
        """Test that whitespace is stripped."""
        result = validate_date_string("  2025-11-24  ")
        assert result == "2025-11-24"

    def test_validate_date_string_not_string(self):
        """Test that non-string date is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string(20251124)

        assert "Must be string" in exc_info.value.message

    def test_validate_date_string_wrong_format_dmy(self):
        """Test that DD/MM/YYYY format is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("24/11/2025")

        assert "Invalid date format" in exc_info.value.message
        assert "YYYY-MM-DD" in exc_info.value.message

    def test_validate_date_string_wrong_format_mdy(self):
        """Test that MM/DD/YYYY format is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("11/24/2025")

        assert "Invalid date format" in exc_info.value.message

    def test_validate_date_string_missing_leading_zeros(self):
        """Test that dates without leading zeros are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("2025-1-1")

        assert "Invalid date format" in exc_info.value.message

    def test_validate_date_string_year_too_old(self):
        """Test that year before 1900 is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("1899-12-31")

        assert "Year out of reasonable range" in exc_info.value.message

    def test_validate_date_string_year_too_future(self):
        """Test that year after 2100 is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("2101-01-01")

        assert "Year out of reasonable range" in exc_info.value.message

    def test_validate_date_string_month_zero(self):
        """Test that month 0 is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("2025-00-15")

        assert "Month must be between 1 and 12" in exc_info.value.message

    def test_validate_date_string_month_13(self):
        """Test that month 13 is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("2025-13-15")

        assert "Month must be between 1 and 12" in exc_info.value.message

    def test_validate_date_string_day_zero(self):
        """Test that day 0 is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("2025-11-00")

        assert "Day must be between 1 and 31" in exc_info.value.message

    def test_validate_date_string_day_32(self):
        """Test that day 32 is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("2025-11-32")

        assert "Day must be between 1 and 31" in exc_info.value.message

    def test_validate_date_string_custom_field_name(self):
        """Test that custom field name is used in error messages."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_string("invalid", "birth_date")

        assert exc_info.value.field == "birth_date"


class TestSecurityScenarios:
    """Tests for various security attack scenarios."""

    def test_guid_sql_injection_attempt(self):
        """Test that SQL injection attempts in GUID are blocked."""
        with pytest.raises(ValidationError):
            validate_guid("'; DROP TABLE users; --")

    def test_csv_command_injection_cmd(self):
        """Test that CMD command injection is blocked."""
        with pytest.raises(ValidationError):
            validate_csv_safe_string("=cmd|'/c calc'", "field")

    def test_csv_command_injection_formula(self):
        """Test that complex Excel formula injection is blocked."""
        with pytest.raises(ValidationError):
            validate_csv_safe_string("=HYPERLINK('http://evil.com', 'Click')", "field")

    def test_email_xss_attempt(self):
        """Test that XSS attempts in email are blocked."""
        with pytest.raises(ValidationError):
            validate_email("<script>alert('xss')</script>@example.com")

    def test_date_injection_attempt(self):
        """Test that injection attempts in date are blocked."""
        with pytest.raises(ValidationError):
            validate_date_string("2025-11-24'; DROP TABLE--")

    def test_very_long_string_dos_attempt(self):
        """Test that very long strings are rejected (DoS prevention)."""
        huge_string = "a" * 100000

        with pytest.raises(ValidationError) as exc_info:
            validate_csv_safe_string(huge_string, "field")

        assert "Exceeds maximum length" in exc_info.value.message


class TestInternalTestHelper:
    """Tests for internal test helper function."""

    def test_validation_test_helper_runs_successfully(self, capsys):
        """Test that _test_validation() helper runs all validation checks."""
        from lib.security.validation import _test_validation

        # Run the internal test helper
        _test_validation()

        # Verify it printed success message
        captured = capsys.readouterr()
        assert "Testing validation functions" in captured.out
        assert "All validation tests passed" in captured.out
        assert "Valid GUID accepted" in captured.out
        assert "CSV injection rejected" in captured.out
        assert "Invalid email rejected" in captured.out
