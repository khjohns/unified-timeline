"""
Tests for Sak domain model.

Verifies Pydantic v2 validation, factory methods, and serialization.
"""
import pytest
from datetime import datetime
from pydantic import ValidationError

from models.sak import Sak
from core.generated_constants import SAK_STATUS


class TestSak:
    """Test suite for Sak model"""

    # ========================================================================
    # Basic Validation Tests
    # ========================================================================

    def test_sak_creation_with_minimal_required_fields(self):
        """Test creating Sak with only required fields"""
        sak = Sak(
            sak_id='KOE-20251130-123456',
            sakstittel='Test sak',
            status=SAK_STATUS['UNDER_VARSLING']
        )

        assert sak.sak_id == 'KOE-20251130-123456'
        assert sak.sakstittel == 'Test sak'
        assert sak.status == SAK_STATUS['UNDER_VARSLING']
        # Check defaults
        assert sak.modus is None
        assert sak.rolle == 'TE'
        assert sak.byggherre == 'Ikke spesifisert'
        assert sak.entreprenor == 'Ikke spesifisert'
        assert sak.prosjekt_navn == 'Ukjent prosjekt'

    def test_sak_creation_with_all_fields(self):
        """Test creating Sak with all fields populated"""
        sak = Sak(
            sak_id='KOE-20251130-123456',
            sakstittel='Grunnforhold avviker',
            status=SAK_STATUS['VARSLET'],
            modus='koe',
            rolle='BH',
            catenda_topic_id='topic-abc-123',
            catenda_project_id='project-456',
            catenda_board_id='board-789',
            opprettet_dato='2025-11-30',
            opprettet_av='John Doe',
            te_navn='John Doe',
            byggherre='Oslo Kommune',
            entreprenor='Byggfirma AS',
            prosjekt_navn='Nybygg Skole'
        )

        assert sak.sak_id == 'KOE-20251130-123456'
        assert sak.sakstittel == 'Grunnforhold avviker'
        assert sak.status == SAK_STATUS['VARSLET']
        assert sak.modus == 'koe'
        assert sak.rolle == 'BH'
        assert sak.catenda_topic_id == 'topic-abc-123'
        assert sak.catenda_project_id == 'project-456'
        assert sak.catenda_board_id == 'board-789'
        assert sak.opprettet_dato == '2025-11-30'
        assert sak.opprettet_av == 'John Doe'
        assert sak.te_navn == 'John Doe'
        assert sak.byggherre == 'Oslo Kommune'
        assert sak.entreprenor == 'Byggfirma AS'
        assert sak.prosjekt_navn == 'Nybygg Skole'

    def test_sak_missing_required_sak_id(self):
        """Test that sak_id is required"""
        with pytest.raises(ValidationError) as exc_info:
            Sak(
                sakstittel='Test',
                status='100000000'
            )

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('sak_id',) for e in errors)

    def test_sak_missing_required_sakstittel(self):
        """Test that sakstittel is required"""
        with pytest.raises(ValidationError) as exc_info:
            Sak(
                sak_id='KOE-123',
                status='100000000'
            )

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('sakstittel',) for e in errors)

    def test_sak_missing_required_status(self):
        """Test that status is required"""
        with pytest.raises(ValidationError) as exc_info:
            Sak(
                sak_id='KOE-123',
                sakstittel='Test'
            )

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('status',) for e in errors)

    def test_sak_empty_sakstittel_fails_min_length(self):
        """Test that sakstittel must have min_length=1"""
        with pytest.raises(ValidationError) as exc_info:
            Sak(
                sak_id='KOE-123',
                sakstittel='',
                status='100000000'
            )

        errors = exc_info.value.errors()
        assert any(e['loc'] == ('sakstittel',) and 'at least 1 character' in str(e['msg']).lower() for e in errors)

    # ========================================================================
    # Date Validation Tests
    # ========================================================================

    def test_sak_valid_opprettet_dato(self):
        """Test that valid ISO date format is accepted"""
        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test',
            status='100000000',
            opprettet_dato='2025-11-30'
        )

        assert sak.opprettet_dato == '2025-11-30'

    def test_sak_invalid_opprettet_dato_format(self):
        """Test that invalid date format is rejected"""
        with pytest.raises(ValidationError) as exc_info:
            Sak(
                sak_id='KOE-123',
                sakstittel='Test',
                status='100000000',
                opprettet_dato='30/11/2025'  # Wrong format
            )

        errors = exc_info.value.errors()
        assert any('Invalid date format' in str(e['msg']) for e in errors)

    def test_sak_invalid_opprettet_dato_not_a_date(self):
        """Test that non-date string is rejected"""
        with pytest.raises(ValidationError) as exc_info:
            Sak(
                sak_id='KOE-123',
                sakstittel='Test',
                status='100000000',
                opprettet_dato='not-a-date'
            )

        errors = exc_info.value.errors()
        assert any('Invalid date format' in str(e['msg']) for e in errors)

    def test_sak_none_opprettet_dato_is_valid(self):
        """Test that None is valid for optional opprettet_dato"""
        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test',
            status='100000000',
            opprettet_dato=None
        )

        assert sak.opprettet_dato is None

    # ========================================================================
    # from_form_data() Factory Method Tests
    # ========================================================================

    def test_from_form_data_complete(self):
        """Test from_form_data with complete form data"""
        form_data = {
            'sak': {
                'sak_id': 'KOE-20251130-123456',
                'sakstittel': 'Test sak',
                'status': SAK_STATUS['VARSLET'],
                'modus': 'koe',
                'rolle': 'BH',
                'catenda_topic_id': 'topic-123',
                'catenda_project_id': 'project-456',
                'catenda_board_id': 'board-789',
                'opprettet_dato': '2025-11-30',
                'opprettet_av': 'John Doe',
                'te_navn': 'John Doe',
                'byggherre': 'Oslo Kommune',
                'entreprenor': 'Byggfirma AS',
                'prosjekt_navn': 'Nybygg Skole'
            }
        }

        sak = Sak.from_form_data(form_data)

        assert sak.sak_id == 'KOE-20251130-123456'
        assert sak.sakstittel == 'Test sak'
        assert sak.status == SAK_STATUS['VARSLET']
        assert sak.modus == 'koe'
        assert sak.rolle == 'BH'
        assert sak.catenda_topic_id == 'topic-123'
        assert sak.byggherre == 'Oslo Kommune'

    def test_from_form_data_minimal(self):
        """Test from_form_data with minimal form data"""
        form_data = {
            'sak': {
                'sak_id': 'KOE-123',
                'sakstittel': 'Minimal sak',
                'status': '100000000'
            }
        }

        sak = Sak.from_form_data(form_data)

        assert sak.sak_id == 'KOE-123'
        assert sak.sakstittel == 'Minimal sak'
        assert sak.status == '100000000'
        # Check defaults are applied
        assert sak.rolle == 'TE'
        assert sak.byggherre == 'Ikke spesifisert'
        assert sak.entreprenor == 'Ikke spesifisert'
        assert sak.prosjekt_navn == 'Ukjent prosjekt'

    def test_from_form_data_empty_sak_dict(self):
        """Test from_form_data with empty sak dict"""
        form_data = {'sak': {}}

        with pytest.raises(ValidationError):
            Sak.from_form_data(form_data)

    def test_from_form_data_missing_sak_key(self):
        """Test from_form_data when 'sak' key is missing"""
        form_data = {}

        with pytest.raises(ValidationError):
            Sak.from_form_data(form_data)

    def test_from_form_data_applies_defaults(self):
        """Test that from_form_data applies default values correctly"""
        form_data = {
            'sak': {
                'sak_id': 'KOE-123',
                'sakstittel': 'Test',
                'status': '100000000'
                # No byggherre, entreprenor, prosjekt_navn specified
            }
        }

        sak = Sak.from_form_data(form_data)

        assert sak.byggherre == 'Ikke spesifisert'
        assert sak.entreprenor == 'Ikke spesifisert'
        assert sak.prosjekt_navn == 'Ukjent prosjekt'
        assert sak.rolle == 'TE'

    # ========================================================================
    # create_from_webhook() Factory Method Tests
    # ========================================================================

    def test_create_from_webhook_minimal(self):
        """Test create_from_webhook with minimal required arguments"""
        sak = Sak.create_from_webhook(
            sak_id='KOE-20251130-123456',
            catenda_topic_id='topic-abc-123',
            sakstittel='Webhook sak',
            status=SAK_STATUS['UNDER_VARSLING']
        )

        assert sak.sak_id == 'KOE-20251130-123456'
        assert sak.catenda_topic_id == 'topic-abc-123'
        assert sak.sakstittel == 'Webhook sak'
        assert sak.status == SAK_STATUS['UNDER_VARSLING']
        # Check auto-set values
        assert sak.modus == 'varsel'
        assert sak.rolle == 'TE'
        assert sak.opprettet_dato == datetime.now().strftime('%Y-%m-%d')
        # Check defaults
        assert sak.byggherre == 'Ikke spesifisert'
        assert sak.entreprenor == 'Ikke spesifisert'
        assert sak.prosjekt_navn == 'Ukjent prosjekt'

    def test_create_from_webhook_complete(self):
        """Test create_from_webhook with all arguments"""
        sak = Sak.create_from_webhook(
            sak_id='KOE-20251130-123456',
            catenda_topic_id='topic-abc-123',
            sakstittel='Komplett webhook sak',
            status=SAK_STATUS['UNDER_VARSLING'],
            catenda_project_id='project-456',
            catenda_board_id='board-789',
            te_navn='Jane Smith',
            byggherre='Oslo Kommune',
            entreprenor='Byggfirma AS',
            prosjekt_navn='Nybygg Skole'
        )

        assert sak.sak_id == 'KOE-20251130-123456'
        assert sak.catenda_topic_id == 'topic-abc-123'
        assert sak.catenda_project_id == 'project-456'
        assert sak.catenda_board_id == 'board-789'
        assert sak.sakstittel == 'Komplett webhook sak'
        assert sak.status == SAK_STATUS['UNDER_VARSLING']
        assert sak.te_navn == 'Jane Smith'
        assert sak.opprettet_av == 'Jane Smith'
        assert sak.byggherre == 'Oslo Kommune'
        assert sak.entreprenor == 'Byggfirma AS'
        assert sak.prosjekt_navn == 'Nybygg Skole'

    def test_create_from_webhook_auto_sets_opprettet_dato(self):
        """Test that create_from_webhook auto-sets opprettet_dato to today"""
        sak = Sak.create_from_webhook(
            sak_id='KOE-123',
            catenda_topic_id='topic-123',
            sakstittel='Test',
            status='100000000'
        )

        expected_date = datetime.now().strftime('%Y-%m-%d')
        assert sak.opprettet_dato == expected_date

    def test_create_from_webhook_sets_initial_modus(self):
        """Test that create_from_webhook sets modus='varsel'"""
        sak = Sak.create_from_webhook(
            sak_id='KOE-123',
            catenda_topic_id='topic-123',
            sakstittel='Test',
            status='100000000'
        )

        assert sak.modus == 'varsel'

    def test_create_from_webhook_sets_opprettet_av_from_te_navn(self):
        """Test that opprettet_av is set from te_navn"""
        sak = Sak.create_from_webhook(
            sak_id='KOE-123',
            catenda_topic_id='topic-123',
            sakstittel='Test',
            status='100000000',
            te_navn='John Doe'
        )

        assert sak.opprettet_av == 'John Doe'
        assert sak.te_navn == 'John Doe'

    # ========================================================================
    # to_dict() Serialization Tests
    # ========================================================================

    def test_to_dict_complete(self):
        """Test to_dict with all fields populated"""
        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test sak',
            status='100000000',
            modus='koe',
            rolle='BH',
            catenda_topic_id='topic-123',
            catenda_project_id='project-456',
            catenda_board_id='board-789',
            opprettet_dato='2025-11-30',
            opprettet_av='John Doe',
            te_navn='John Doe',
            byggherre='Oslo Kommune',
            entreprenor='Byggfirma AS',
            prosjekt_navn='Nybygg Skole'
        )

        data = sak.to_dict()

        assert data['sak_id'] == 'KOE-123'
        assert data['sakstittel'] == 'Test sak'
        assert data['status'] == '100000000'
        assert data['modus'] == 'koe'
        assert data['rolle'] == 'BH'
        assert data['catenda_topic_id'] == 'topic-123'
        assert data['byggherre'] == 'Oslo Kommune'

    def test_to_dict_includes_none_values(self):
        """Test that to_dict includes None values (exclude_none=False)"""
        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test',
            status='100000000'
            # Optional fields will be None or defaults
        )

        data = sak.to_dict()

        # None values should be included
        assert 'modus' in data
        assert 'catenda_topic_id' in data
        assert 'catenda_project_id' in data

    def test_to_dict_includes_default_values(self):
        """Test that to_dict includes default values"""
        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test',
            status='100000000'
        )

        data = sak.to_dict()

        assert data['rolle'] == 'TE'
        assert data['byggherre'] == 'Ikke spesifisert'
        assert data['entreprenor'] == 'Ikke spesifisert'
        assert data['prosjekt_navn'] == 'Ukjent prosjekt'

    # ========================================================================
    # to_csv_row() Serialization Tests
    # ========================================================================

    def test_to_csv_row_complete(self):
        """Test to_csv_row with all fields populated"""
        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test sak',
            status='100000000',
            modus='koe',
            catenda_topic_id='topic-123',
            catenda_project_id='project-456',
            catenda_board_id='board-789',
            opprettet_dato='2025-11-30',
            opprettet_av='John Doe',
            te_navn='John Doe',
            byggherre='Oslo Kommune',
            entreprenor='Byggfirma AS',
            prosjekt_navn='Nybygg Skole'
        )

        row = sak.to_csv_row()

        # Verify all expected CSV fields are present
        assert row['sak_id'] == 'KOE-123'
        assert row['catenda_topic_id'] == 'topic-123'
        assert row['catenda_project_id'] == 'project-456'
        assert row['catenda_board_id'] == 'board-789'
        assert row['sakstittel'] == 'Test sak'
        assert row['opprettet_dato'] == '2025-11-30'
        assert row['opprettet_av'] == 'John Doe'
        assert row['status'] == '100000000'
        assert row['te_navn'] == 'John Doe'
        assert row['modus'] == 'koe'
        assert row['byggherre'] == 'Oslo Kommune'
        assert row['entreprenor'] == 'Byggfirma AS'
        assert row['prosjekt_navn'] == 'Nybygg Skole'

    def test_to_csv_row_converts_none_to_empty_string(self):
        """Test that to_csv_row converts None values to empty strings"""
        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test',
            status='100000000'
            # Optional fields are None
        )

        row = sak.to_csv_row()

        # None values should be converted to empty strings for CSV
        assert row['catenda_topic_id'] == ''
        assert row['catenda_project_id'] == ''
        assert row['catenda_board_id'] == ''
        assert row['opprettet_dato'] == ''
        assert row['opprettet_av'] == ''
        assert row['te_navn'] == ''
        assert row['modus'] == ''

    def test_to_csv_row_preserves_default_values(self):
        """Test that to_csv_row preserves default values"""
        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test',
            status='100000000'
        )

        row = sak.to_csv_row()

        # Default values should be preserved (not converted to empty string)
        assert row['byggherre'] == 'Ikke spesifisert'
        assert row['entreprenor'] == 'Ikke spesifisert'
        assert row['prosjekt_navn'] == 'Ukjent prosjekt'

    def test_to_csv_row_matches_csv_repository_fieldnames(self):
        """Test that to_csv_row keys match CSVRepository.SAKER_FIELDNAMES"""
        from repositories.csv_repository import CSVRepository

        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test',
            status='100000000'
        )

        row = sak.to_csv_row()

        # All CSV fieldnames should be present
        expected_fields = set(CSVRepository.SAKER_FIELDNAMES)
        actual_fields = set(row.keys())

        assert expected_fields == actual_fields, f"Missing fields: {expected_fields - actual_fields}, Extra fields: {actual_fields - expected_fields}"

    # ========================================================================
    # Edge Cases and Integration Tests
    # ========================================================================

    def test_sak_roundtrip_to_dict_and_back(self):
        """Test that we can convert to dict and back"""
        original_sak = Sak(
            sak_id='KOE-123',
            sakstittel='Test sak',
            status='100000000',
            modus='koe',
            rolle='BH',
            catenda_topic_id='topic-123',
            opprettet_dato='2025-11-30',
            byggherre='Oslo Kommune'
        )

        # Convert to dict
        data = original_sak.to_dict()

        # Create new instance from dict
        reconstructed_sak = Sak(**data)

        # Verify all fields match
        assert reconstructed_sak.sak_id == original_sak.sak_id
        assert reconstructed_sak.sakstittel == original_sak.sakstittel
        assert reconstructed_sak.status == original_sak.status
        assert reconstructed_sak.modus == original_sak.modus
        assert reconstructed_sak.rolle == original_sak.rolle
        assert reconstructed_sak.catenda_topic_id == original_sak.catenda_topic_id
        assert reconstructed_sak.byggherre == original_sak.byggherre

    def test_sak_handles_special_characters_in_text_fields(self):
        """Test that special characters are handled correctly"""
        sak = Sak(
            sak_id='KOE-123',
            sakstittel='Sak med æøå og "spesialtegn"',
            status='100000000',
            byggherre='Øst-Norge AS',
            entreprenor='Ålesund Bygg & Anlegg'
        )

        assert sak.sakstittel == 'Sak med æøå og "spesialtegn"'
        assert sak.byggherre == 'Øst-Norge AS'
        assert sak.entreprenor == 'Ålesund Bygg & Anlegg'

        # Verify serialization preserves special characters
        data = sak.to_dict()
        assert data['sakstittel'] == 'Sak med æøå og "spesialtegn"'

    def test_sak_very_long_sakstittel(self):
        """Test that very long sakstittel is accepted (no max length)"""
        long_title = 'A' * 1000

        sak = Sak(
            sak_id='KOE-123',
            sakstittel=long_title,
            status='100000000'
        )

        assert len(sak.sakstittel) == 1000
