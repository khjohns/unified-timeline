"""
Tests for API validators.

Tests NS 8407 validation rules for grunnlag, vederlag, and frist events.
"""
import pytest
from api.validators import (
    validate_grunnlag_event,
    validate_vederlag_event,
    validate_frist_event,
    validate_respons_event,
    ValidationError
)


class TestGrunnlagValidator:
    """Test grunnlag event validation."""

    def test_valid_grunnlag_data(self):
        """Test that valid grunnlag data passes validation."""
        data = {
            'hovedkategori': 'endring_initiert_bh',
            'underkategori': 'regulaer_eo',
            'beskrivelse': 'Test beskrivelse',
            'dato_oppdaget': '2025-01-15'
        }
        # Should not raise
        validate_grunnlag_event(data)

    def test_grunnlag_missing_hovedkategori(self):
        """Test that missing hovedkategori raises error."""
        data = {
            'underkategori': 'regulaer_eo',
            'beskrivelse': 'Test',
            'dato_oppdaget': '2025-01-15'
        }
        with pytest.raises(ValidationError, match="hovedkategori"):
            validate_grunnlag_event(data)

    def test_grunnlag_invalid_hovedkategori(self):
        """Test that invalid hovedkategori raises error."""
        data = {
            'hovedkategori': 'invalid_category',
            'underkategori': 'regulaer_eo',
            'beskrivelse': 'Test',
            'dato_oppdaget': '2025-01-15'
        }
        with pytest.raises(ValidationError, match="Ugyldig kategori-kombinasjon"):
            validate_grunnlag_event(data)

    def test_grunnlag_invalid_underkategori_for_category(self):
        """Test that underkategori must match hovedkategori."""
        data = {
            'hovedkategori': 'endring_initiert_bh',
            'underkategori': 'invalid_sub',  # Not valid for this category
            'beskrivelse': 'Test',
            'dato_oppdaget': '2025-01-15'
        }
        with pytest.raises(ValidationError, match="Ugyldig kategori-kombinasjon"):
            validate_grunnlag_event(data)

    def test_grunnlag_missing_beskrivelse(self):
        """Test that beskrivelse is required."""
        data = {
            'hovedkategori': 'endring_initiert_bh',
            'underkategori': 'regulaer_eo',
            'dato_oppdaget': '2025-01-15'
        }
        with pytest.raises(ValidationError, match="beskrivelse"):
            validate_grunnlag_event(data)

    def test_grunnlag_multiple_underkategorier(self):
        """Test that multiple underkategorier are allowed."""
        data = {
            'hovedkategori': 'endring_initiert_bh',
            'underkategori': ['regulaer_eo', 'mengdeendring'],
            'beskrivelse': 'Test',
            'dato_oppdaget': '2025-01-15'
        }
        # Should not raise
        validate_grunnlag_event(data)

    def test_grunnlag_with_varsel_info(self):
        """Test grunnlag with varsel info."""
        data = {
            'hovedkategori': 'endring_initiert_bh',
            'underkategori': 'regulaer_eo',
            'beskrivelse': 'Test',
            'dato_oppdaget': '2025-01-15',
            'grunnlag_varsel': {
                'dato_sendt': '2025-01-10',
                'metode': ['epost', 'byggemote']
            }
        }
        # Should not raise
        validate_grunnlag_event(data)


class TestVederlagValidator:
    """Test vederlag event validation."""

    def test_valid_vederlag_kontrakt_ep(self):
        """Test valid vederlag with kontraktens enhetspriser."""
        data = {
            'krav_belop': 50000,
            'metode': 'kontrakt_ep',
            'begrunnelse': 'Test begrunnelse'
        }
        # Should not raise
        validate_vederlag_event(data)

    def test_valid_vederlag_regning(self):
        """Test valid vederlag with regningsarbeid."""
        data = {
            'krav_belop': 50000,
            'metode': 'regning',
            'begrunnelse': 'Test begrunnelse',
            'krever_regningsarbeid': True,
            'regningsarbeid_varsel': {
                'dato_sendt': '2025-01-10',
                'metode': ['epost']
            }
        }
        # Should not raise
        validate_vederlag_event(data)

    def test_vederlag_missing_data(self):
        """Test that missing data raises error."""
        with pytest.raises(ValidationError, match="Vederlag data mangler"):
            validate_vederlag_event(None)

    def test_vederlag_missing_metode(self):
        """Test that missing metode raises error."""
        data = {
            'krav_belop': 50000,
            'begrunnelse': 'Test'
        }
        with pytest.raises(ValidationError, match="metode er påkrevd"):
            validate_vederlag_event(data)

    def test_vederlag_invalid_metode(self):
        """Test that invalid metode raises error."""
        data = {
            'krav_belop': 50000,
            'metode': 'invalid_method',
            'begrunnelse': 'Test'
        }
        with pytest.raises(ValidationError, match="Ukjent vederlagsmetode"):
            validate_vederlag_event(data)

    def test_vederlag_negative_amount(self):
        """Test that negative amount raises error."""
        data = {
            'krav_belop': -1000,
            'metode': 'kontrakt_ep',
            'begrunnelse': 'Test'
        }
        with pytest.raises(ValidationError, match="krav_belop må være >= 0"):
            validate_vederlag_event(data)

    def test_vederlag_missing_begrunnelse(self):
        """Test that missing begrunnelse raises error."""
        data = {
            'krav_belop': 50000,
            'metode': 'kontrakt_ep'
        }
        with pytest.raises(ValidationError, match="begrunnelse er påkrevd"):
            validate_vederlag_event(data)

    def test_vederlag_regning_requires_varsel(self):
        """Test that regningsarbeid requires varsel before work starts (§30.1)."""
        data = {
            'krav_belop': 50000,
            'metode': 'regning',
            'begrunnelse': 'Test',
            'krever_regningsarbeid': True
            # Missing regningsarbeid_varsel
        }
        with pytest.raises(ValidationError, match="Regningsarbeid krever varsel før oppstart"):
            validate_vederlag_event(data)

    def test_vederlag_rigg_drift_requires_varsel(self):
        """Test that rigg/drift costs require varsel (§34.1.3)."""
        data = {
            'krav_belop': 50000,
            'metode': 'kontrakt_ep',
            'begrunnelse': 'Test',
            'inkluderer_rigg_drift': True,
            'rigg_drift_belop': 10000
            # Missing rigg_drift_varsel
        }
        with pytest.raises(ValidationError, match="Rigg/drift-kostnader krever særskilt varsel"):
            validate_vederlag_event(data)

    def test_vederlag_produktivitetstap_requires_varsel(self):
        """Test that produktivitetstap requires varsel (§34.1.3)."""
        data = {
            'krav_belop': 50000,
            'metode': 'kontrakt_ep',
            'begrunnelse': 'Test',
            'inkluderer_produktivitetstap': True,
            'produktivitetstap_belop': 5000
            # Missing produktivitetstap_varsel
        }
        with pytest.raises(ValidationError, match="Produktivitetstap krever særskilt varsel"):
            validate_vederlag_event(data)

    def test_vederlag_justert_ep_requires_varsel(self):
        """Test that justerte enhetspriser require varsel (§34.3.3)."""
        data = {
            'krav_belop': 50000,
            'metode': 'justert_ep',
            'begrunnelse': 'Test',
            'krever_justert_ep': True
            # Missing justert_ep_varsel
        }
        with pytest.raises(ValidationError, match="Justerte enhetspriser krever varsel"):
            validate_vederlag_event(data)

    def test_vederlag_with_all_varsler(self):
        """Test vederlag with all types of varsler."""
        data = {
            'krav_belop': 100000,
            'metode': 'regning',
            'begrunnelse': 'Kompleks endring',
            'krever_regningsarbeid': True,
            'regningsarbeid_varsel': {
                'dato_sendt': '2025-01-10',
                'metode': ['epost']
            },
            'inkluderer_rigg_drift': True,
            'rigg_drift_belop': 15000,
            'rigg_drift_varsel': {
                'dato_sendt': '2025-01-11',
                'metode': ['byggemote']
            },
            'inkluderer_produktivitetstap': True,
            'produktivitetstap_belop': 20000,
            'produktivitetstap_varsel': {
                'dato_sendt': '2025-01-12',
                'metode': ['epost']
            }
        }
        # Should not raise
        validate_vederlag_event(data)


class TestFristValidator:
    """Test frist event validation."""

    def test_valid_frist_noytralt(self):
        """Test valid nøytralt fristkrav."""
        data = {
            'varsel_type': 'noytralt',
            'begrunnelse': 'Test begrunnelse',
            'noytralt_varsel': {
                'dato_sendt': '2025-01-10',
                'metode': ['epost']
            }
        }
        # Should not raise
        validate_frist_event(data)

    def test_valid_frist_spesifisert(self):
        """Test valid spesifisert fristkrav."""
        data = {
            'varsel_type': 'spesifisert',
            'antall_dager': 14,
            'begrunnelse': 'Test begrunnelse',
            'spesifisert_varsel': {
                'dato_sendt': '2025-01-10',
                'metode': ['epost']
            }
        }
        # Should not raise
        validate_frist_event(data)

    def test_frist_missing_data(self):
        """Test that missing data raises error."""
        with pytest.raises(ValidationError, match="Frist data mangler"):
            validate_frist_event(None)

    def test_frist_missing_varsel_type(self):
        """Test that missing varsel_type raises error."""
        data = {
            'begrunnelse': 'Test'
        }
        with pytest.raises(ValidationError, match="varsel_type er påkrevd"):
            validate_frist_event(data)

    def test_frist_invalid_varsel_type(self):
        """Test that invalid varsel_type raises error."""
        data = {
            'varsel_type': 'invalid_type',
            'begrunnelse': 'Test'
        }
        with pytest.raises(ValidationError, match="Ugyldig varsel_type"):
            validate_frist_event(data)

    def test_frist_spesifisert_requires_antall_dager(self):
        """Test that spesifisert requires antall_dager."""
        data = {
            'varsel_type': 'spesifisert',
            'begrunnelse': 'Test',
            'spesifisert_varsel': {
                'dato_sendt': '2025-01-10',
                'metode': ['epost']
            }
            # Missing antall_dager
        }
        with pytest.raises(ValidationError, match="antall_dager er påkrevd"):
            validate_frist_event(data)

    def test_frist_negative_dager(self):
        """Test that negative days raises error."""
        data = {
            'varsel_type': 'spesifisert',
            'antall_dager': -5,
            'begrunnelse': 'Test',
            'spesifisert_varsel': {
                'dato_sendt': '2025-01-10',
                'metode': ['epost']
            }
        }
        with pytest.raises(ValidationError, match="antall_dager må være >= 0"):
            validate_frist_event(data)

    def test_frist_missing_begrunnelse(self):
        """Test that missing begrunnelse raises error."""
        data = {
            'varsel_type': 'noytralt',
            'noytralt_varsel': {
                'dato_sendt': '2025-01-10',
                'metode': ['epost']
            }
        }
        with pytest.raises(ValidationError, match="begrunnelse er påkrevd"):
            validate_frist_event(data)

    def test_frist_noytralt_requires_varsel(self):
        """Test that nøytralt requires noytralt_varsel."""
        data = {
            'varsel_type': 'noytralt',
            'begrunnelse': 'Test'
            # Missing noytralt_varsel
        }
        with pytest.raises(ValidationError, match="noytralt_varsel er påkrevd"):
            validate_frist_event(data)

    def test_frist_spesifisert_requires_varsel(self):
        """Test that spesifisert requires spesifisert_varsel."""
        data = {
            'varsel_type': 'spesifisert',
            'antall_dager': 10,
            'begrunnelse': 'Test'
            # Missing spesifisert_varsel
        }
        with pytest.raises(ValidationError, match="spesifisert_varsel er påkrevd"):
            validate_frist_event(data)

    def test_frist_begge_requires_both_varsler(self):
        """Test that 'begge' requires both varsler."""
        data = {
            'varsel_type': 'begge',
            'antall_dager': 10,
            'begrunnelse': 'Test',
            'noytralt_varsel': {
                'dato_sendt': '2025-01-05',
                'metode': ['epost']
            }
            # Missing spesifisert_varsel
        }
        with pytest.raises(ValidationError, match="spesifisert_varsel er påkrevd"):
            validate_frist_event(data)

    def test_frist_begge_with_both_varsler(self):
        """Test valid 'begge' with both varsler."""
        data = {
            'varsel_type': 'begge',
            'antall_dager': 10,
            'begrunnelse': 'Test',
            'noytralt_varsel': {
                'dato_sendt': '2025-01-05',
                'metode': ['epost']
            },
            'spesifisert_varsel': {
                'dato_sendt': '2025-01-15',
                'metode': ['byggemote']
            }
        }
        # Should not raise
        validate_frist_event(data)


class TestResponsValidator:
    """Test respons event validation."""

    def test_valid_grunnlag_respons(self):
        """Test valid grunnlag response."""
        data = {
            'resultat': 'godkjent',
            'begrunnelse': 'Grunnlaget aksepteres'
        }
        # Should not raise
        validate_respons_event(data, spor_type='grunnlag')

    def test_valid_vederlag_respons(self):
        """Test valid vederlag response."""
        data = {
            'beregnings_resultat': 'godkjent_fullt',
            'begrunnelse': 'Kravet godkjennes',
            'godkjent_belop': 50000
        }
        # Should not raise
        validate_respons_event(data, spor_type='vederlag')

    def test_valid_frist_respons(self):
        """Test valid frist response."""
        data = {
            'beregnings_resultat': 'godkjent_fullt',
            'spesifisert_krav_ok': True,
            'vilkar_oppfylt': True,
            'godkjent_dager': 10
        }
        # Should not raise
        validate_respons_event(data, spor_type='frist')

    def test_respons_missing_data(self):
        """Test that missing data raises error."""
        with pytest.raises(ValidationError, match="Respons data mangler"):
            validate_respons_event(None, spor_type='grunnlag')

    def test_grunnlag_respons_missing_resultat(self):
        """Test that grunnlag response requires resultat."""
        data = {'begrunnelse': 'Test'}
        with pytest.raises(ValidationError, match="resultat er påkrevd"):
            validate_respons_event(data, spor_type='grunnlag')

    def test_grunnlag_respons_missing_begrunnelse(self):
        """Test that grunnlag response requires begrunnelse."""
        data = {'resultat': 'godkjent'}
        with pytest.raises(ValidationError, match="begrunnelse er påkrevd"):
            validate_respons_event(data, spor_type='grunnlag')

    def test_vederlag_respons_missing_beregnings_resultat(self):
        """Test that vederlag response requires beregnings_resultat."""
        data = {'begrunnelse': 'Test'}
        with pytest.raises(ValidationError, match="beregnings_resultat er påkrevd"):
            validate_respons_event(data, spor_type='vederlag')

    def test_frist_respons_missing_beregnings_resultat(self):
        """Test that frist response requires beregnings_resultat."""
        data = {
            'spesifisert_krav_ok': True,
            'vilkar_oppfylt': True
        }
        with pytest.raises(ValidationError, match="beregnings_resultat er påkrevd"):
            validate_respons_event(data, spor_type='frist')

    def test_frist_respons_missing_spesifisert_krav_ok(self):
        """Test that frist response requires spesifisert_krav_ok."""
        data = {
            'beregnings_resultat': 'godkjent_fullt',
            'vilkar_oppfylt': True
        }
        with pytest.raises(ValidationError, match="spesifisert_krav_ok er påkrevd"):
            validate_respons_event(data, spor_type='frist')

    def test_frist_respons_missing_vilkar_oppfylt(self):
        """Test that frist response requires vilkar_oppfylt."""
        data = {
            'beregnings_resultat': 'godkjent_fullt',
            'spesifisert_krav_ok': True
        }
        with pytest.raises(ValidationError, match="vilkar_oppfylt er påkrevd"):
            validate_respons_event(data, spor_type='frist')
