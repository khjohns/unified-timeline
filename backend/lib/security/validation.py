"""
Request Validation Module

Implementerer input-validering og sanitering for å beskytte mot:
- CSV Injection (formula injection i Excel/Sheets)
- Path Traversal angrep (../../etc/passwd)
- XSS (Cross-Site Scripting)
- Datakorrupsjon
- Ugyldig data format

Spesielt viktig for dette prosjektet siden vi bruker CSV-lagring,
som er ekstra sårbart for injection-angrep.

Catenda/BCF API Compliance:
- GUID format: 32 hex chars (compacted UUID) eller 36 chars (standard UUID)
- Topic status: Standard BCF verdier (Draft, Open, Active, Resolved, Closed)
- String lengde limits basert på database best practices

Referanser:
- OWASP Input Validation Cheat Sheet
- CSV Injection (OWASP)
- Catenda Topic API.yaml (BCF 3.0 standard)
- RFC 4122 (UUID specification)

Forfatter: Claude
Dato: 2025-11-24
"""

import re
from typing import Any


class ValidationError(Exception):
    """
    Custom exception for validation errors.

    Inneholder både feltnavn og feilmelding for å gi klar feedback til klienten.

    Attributes:
        field: Navnet på feltet som feilet validering
        message: Beskrivelse av valideringsfeil
    """

    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"Validation error in '{field}': {message}")


def validate_guid(val: Any, field_name: str = "guid") -> str:
    """
    Validerer GUID (Globally Unique Identifier) basert på Catenda/BCF standard.

    Catenda API bruker "compacted UUID" - 32 hexadecimal characters uten bindestreker.
    Vi tillater også standard UUID format (36 chars med bindestreker) for fleksibilitet.

    Format:
    - Compacted: "18d0273de15c492497b36f47b233eebe" (32 chars)
    - Standard:  "18d0273d-e15c-4924-97b3-6f47b233eebe" (36 chars)

    Security checks:
    - Kun tillater hex chars (0-9, a-f) og bindestreker
    - Blokkerer path traversal (..)
    - Blokkerer directory separators (/ og \\)

    Args:
        val: Verdi som skal valideres (forventes å være string)
        field_name: Navn på felt (for feilmelding)

    Returns:
        str: Validert GUID (lowercase)

    Raises:
        ValidationError: Hvis GUID er ugyldig

    Example:
        >>> validate_guid("18d0273de15c492497b36f47b233eebe")
        '18d0273de15c492497b36f47b233eebe'
        >>> validate_guid("../../etc/passwd")
        ValidationError: Invalid characters
    """
    if not isinstance(val, str):
        raise ValidationError(field_name, "Must be string")

    if not val:
        raise ValidationError(field_name, "Cannot be empty")

    # Convert to lowercase for consistent validation
    val = val.lower()

    # Sjekk format: 32-36 hexadecimal chars (med eller uten bindestreker)
    if not re.match(r"^[a-f0-9-]{32,36}$", val):
        raise ValidationError(
            field_name,
            "Invalid UUID format (expected 32-36 hex characters, optionally with dashes)",
        )

    # Ekstra sikkerhet: Blokkér path traversal attempts
    if ".." in val or "/" in val or "\\" in val:
        raise ValidationError(
            field_name, "Invalid characters (possible path traversal)"
        )

    return val


def validate_csv_safe_string(
    value: Any, field_name: str, max_length: int = 500, allow_newlines: bool = False
) -> str:
    """
    Valider og sanitize string for trygg CSV-lagring.

    CSV Injection Protection:
    Excel/Google Sheets behandler celler som starter med =, +, -, @ eller tab som formler.
    Dette kan brukes til å kjøre vilkårlig kode når CSV-filen åpnes.

    Eksempel på farlig input:
    - "=1+1" → Excel evaluerer som formel
    - "=cmd|'/c calc'" → Kan kjøre kommandoer (Windows)
    - "@SUM(A1:A10)" → Formel

    Beskyttelse:
    1. Fjern kontrollkarakterer (ASCII < 32, unntatt newline hvis tillatt)
    2. Trim whitespace
    3. Sjekk lengdebegrensning
    4. Blokkér strings som starter med farlige tegn
    5. Erstatt internal newlines med space (for single-line CSV fields)

    Args:
        value: Verdi som skal valideres
        field_name: Navn på felt (for feilmelding)
        max_length: Maksimal lengde i characters
        allow_newlines: Om newlines skal tillates (default: False)

    Returns:
        str: Sanitized string (trygg for CSV)

    Raises:
        ValidationError: Hvis input er ugyldig eller farlig

    Example:
        >>> validate_csv_safe_string("Normal text", "title")
        'Normal text'
        >>> validate_csv_safe_string("=1+1", "title")
        ValidationError: Cannot start with special characters (CSV injection)
    """
    if not isinstance(value, str):
        raise ValidationError(field_name, "Must be string")

    # Fjern kontrollkarakterer (ASCII < 32, unntatt space og newline)
    if allow_newlines:
        cleaned = "".join(
            char for char in value if ord(char) >= 32 or char in ["\n", "\r"]
        )
    else:
        cleaned = "".join(char for char in value if ord(char) >= 32)

    # Strip leading/trailing whitespace
    cleaned = cleaned.strip()

    # Sjekk lengde
    if len(cleaned) > max_length:
        raise ValidationError(
            field_name,
            f"Exceeds maximum length of {max_length} characters (got {len(cleaned)})",
        )

    # CSV Injection protection: Blokkér strings som starter med farlige tegn
    if cleaned and cleaned[0] in ["=", "+", "-", "@", "\t", "\r"]:
        raise ValidationError(
            field_name,
            "Cannot start with special characters (CSV injection protection)",
        )

    # Erstatt internal newlines med space (for CSV single-line fields)
    if not allow_newlines:
        cleaned = cleaned.replace("\n", " ").replace("\r", " ")

    return cleaned


def validate_email(email: Any, field_name: str = "email") -> str:
    """
    Validerer e-postadresse format.

    Bruker en enkel men robust regex for e-post validering.
    Ikke 100% RFC-compliant, men dekker de vanligste formatene.

    Args:
        email: E-postadresse som skal valideres
        field_name: Navn på felt (for feilmelding)

    Returns:
        str: Validert e-postadresse (lowercase, trimmed)

    Raises:
        ValidationError: Hvis e-post er ugyldig

    Example:
        >>> validate_email("user@example.com")
        'user@example.com'
        >>> validate_email("not-an-email")
        ValidationError: Invalid email format
    """
    if not isinstance(email, str):
        raise ValidationError(field_name, "Must be string")

    email = email.strip().lower()

    if not email:
        raise ValidationError(field_name, "Cannot be empty")

    # Enkel email regex (dekker 99% av cases)
    email_pattern = r"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
    if not re.match(email_pattern, email):
        raise ValidationError(field_name, "Invalid email format")

    return email


def validate_topic_status(val: Any, field_name: str = "topic_status") -> str:
    """
    Validerer topic_status mot BCF (BIM Collaboration Format) standard.

    Standard BCF topic statuses:
    - Draft: Under arbeid, ikke sendt
    - Open: Sendt og venter på behandling
    - Active: Under aktiv behandling
    - Resolved: Løst, venter på verifisering
    - Closed: Ferdigbehandlet og lukket

    Note: I en produksjonsapp bør gyldige statuser hentes dynamisk fra
    Catenda API endpoint: GET /bcf/3.0/projects/{id}/extensions
    For prototype hardkoder vi standard BCF-verdier.

    Args:
        val: Status-verdi som skal valideres
        field_name: Navn på felt (for feilmelding)

    Returns:
        str: Validert status

    Raises:
        ValidationError: Hvis status er ugyldig

    Example:
        >>> validate_topic_status("Draft")
        'Draft'
        >>> validate_topic_status("InvalidStatus")
        ValidationError: Must be one of: Draft, Open, Active, Resolved, Closed
    """
    # Standard BCF topic statuses
    ALLOWED_STATUSES = ["Draft", "Open", "Active", "Resolved", "Closed"]

    if not isinstance(val, str):
        raise ValidationError(field_name, "Must be string")

    val = val.strip()

    if val not in ALLOWED_STATUSES:
        raise ValidationError(
            field_name, f"Must be one of: {', '.join(ALLOWED_STATUSES)}"
        )

    return val


def validate_sak_status(val: Any, field_name: str = "status") -> str:
    """
    Validerer intern sak-status (vår app-spesifikke statuser).

    Dette er IKKE Catenda BCF statuser, men våre egne workflow-statuser
    som brukes i sak-objektet for å tracke prosess-status.

    Gyldige statuser:
    - 100000000: Under varsling
    - 100000001: Varslet
    - 100000002: Venter på svar
    - 100000003: Under avklaring
    - osv. (se types.ts)

    Args:
        val: Status-verdi som skal valideres
        field_name: Navn på felt (for feilmelding)

    Returns:
        str: Validert status

    Raises:
        ValidationError: Hvis status er ugyldig
    """
    # Liste over gyldige sak-statuser (må synkes med types.ts)
    ALLOWED_STATUSES = [
        "100000000",  # Under varsling
        "100000001",  # Varslet
        "100000002",  # Venter på svar
        "100000003",  # Under avklaring
        "100000005",  # Omforent (EO utstedes)
        "100000006",  # Lukket (Avslått)
        "100000007",  # Vurderes av TE
        "100000008",  # Under tvist
        "100000009",  # Lukket (Tilbakekalt)
        "100000011",  # Lukket (Implementert)
        "100000012",  # Lukket (Annullert)
        "100000013",  # Pågår - Under utførelse
        "",  # Tom status (initiell tilstand)
    ]

    if not isinstance(val, str):
        raise ValidationError(field_name, "Must be string")

    if val not in ALLOWED_STATUSES:
        raise ValidationError(
            field_name, "Invalid status code (must be one of the defined status codes)"
        )

    return val


def validate_positive_number(
    val: Any, field_name: str, allow_zero: bool = True, max_value: float | None = None
) -> float:
    """
    Validerer at verdi er et positivt tall.

    Brukes for beløp, dager, antall, etc.

    Args:
        val: Verdi som skal valideres
        field_name: Navn på felt (for feilmelding)
        allow_zero: Om 0 er en gyldig verdi (default: True)
        max_value: Maksimal tillatt verdi (optional)

    Returns:
        float: Validert tall

    Raises:
        ValidationError: Hvis verdi ikke er et gyldig positivt tall

    Example:
        >>> validate_positive_number("12345", "amount")
        12345.0
        >>> validate_positive_number("-100", "amount")
        ValidationError: Must be positive
    """
    try:
        num = float(val)
    except (ValueError, TypeError):
        raise ValidationError(field_name, "Must be a number")

    if not allow_zero and num == 0:
        raise ValidationError(field_name, "Cannot be zero")

    if num < 0:
        raise ValidationError(field_name, "Must be positive")

    if max_value is not None and num > max_value:
        raise ValidationError(field_name, f"Exceeds maximum value of {max_value}")

    return num


def validate_date_string(val: Any, field_name: str = "date") -> str:
    """
    Validerer dato-string i format YYYY-MM-DD.

    Args:
        val: Dato-string som skal valideres
        field_name: Navn på felt (for feilmelding)

    Returns:
        str: Validert dato-string

    Raises:
        ValidationError: Hvis dato-format er ugyldig

    Example:
        >>> validate_date_string("2025-11-24")
        '2025-11-24'
        >>> validate_date_string("24/11/2025")
        ValidationError: Invalid date format (expected YYYY-MM-DD)
    """
    if not isinstance(val, str):
        raise ValidationError(field_name, "Must be string")

    val = val.strip()

    # Sjekk format: YYYY-MM-DD
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", val):
        raise ValidationError(field_name, "Invalid date format (expected YYYY-MM-DD)")

    # Basic range checks (ikke fullstendig dato-validering)
    parts = val.split("-")
    year, month, day = int(parts[0]), int(parts[1]), int(parts[2])

    if year < 1900 or year > 2100:
        raise ValidationError(field_name, "Year out of reasonable range (1900-2100)")

    if month < 1 or month > 12:
        raise ValidationError(field_name, "Month must be between 1 and 12")

    if day < 1 or day > 31:
        raise ValidationError(field_name, "Day must be between 1 and 31")

    return val


# Helper function for testing
def _test_validation():
    """
    Test validation functions.
    Kjør med: python -c "from validation import _test_validation; _test_validation()"
    """
    print("Testing validation functions...")

    # Test GUID
    assert (
        validate_guid("18d0273de15c492497b36f47b233eebe")
        == "18d0273de15c492497b36f47b233eebe"
    )
    print("✓ Valid GUID accepted")

    try:
        validate_guid("../../etc/passwd")
        assert False, "Path traversal should be rejected"
    except ValidationError:
        print("✓ Path traversal rejected")

    # Test CSV-safe string
    assert validate_csv_safe_string("Normal text", "test") == "Normal text"
    print("✓ Normal string accepted")

    try:
        validate_csv_safe_string("=1+1", "test")
        assert False, "CSV injection should be rejected"
    except ValidationError:
        print("✓ CSV injection rejected")

    # Test email
    assert validate_email("user@example.com") == "user@example.com"
    print("✓ Valid email accepted")

    try:
        validate_email("not-an-email")
        assert False, "Invalid email should be rejected"
    except ValidationError:
        print("✓ Invalid email rejected")

    # Test topic status
    assert validate_topic_status("Draft") == "Draft"
    print("✓ Valid topic status accepted")

    # Test positive number
    assert validate_positive_number("123.45", "amount") == 123.45
    print("✓ Valid number accepted")

    try:
        validate_positive_number("-100", "amount")
        assert False, "Negative number should be rejected"
    except ValidationError:
        print("✓ Negative number rejected")

    # Test date
    assert validate_date_string("2025-11-24") == "2025-11-24"
    print("✓ Valid date accepted")

    print("✅ All validation tests passed!")


if __name__ == "__main__":
    _test_validation()
