/**
 * Functional tests for View Components
 *
 * Tests component behavior, rendering, props, and data display.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComprehensiveMetadata } from '@/components/views/ComprehensiveMetadata';
import type { SakState } from '@/types/timeline';

// Inline mock state for tests
const mockSakState1: SakState = {
  sak_id: 'SAK-2025-001',
  sakstittel: 'Endring av grunnforhold - Bjørvika Utbyggingsprosjekt',
  prosjekt_navn: 'Bjørvika Utbygging',
  entreprenor: 'NCC Norge AS',
  byggherre: 'Oslo kommune',
  sakstype: 'standard',
  grunnlag: {
    status: 'sendt',
    hovedkategori: 'ENDRING',
    underkategori: 'PROSJEKTERING',
    beskrivelse: 'Endring i grunnforhold oppdaget under prosjektering',
    laast: false,
    antall_versjoner: 1,
  },
  vederlag: {
    status: 'sendt',
    metode: 'REGNINGSARBEID',
    kostnads_overslag: 500000,
    antall_versjoner: 1,
  },
  frist: {
    status: 'sendt',
    krevd_dager: 14,
    antall_versjoner: 1,
  },
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: 'Sendt',
  visningsstatus_frist: 'Sendt',
  overordnet_status: 'UNDER_BEHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'BH',
    handling: 'Vurder grunnlag',
    spor: 'grunnlag',
  },
  sum_krevd: 500000,
  sum_godkjent: 0,
  opprettet: '2025-01-15T08:00:00Z',
  siste_aktivitet: '2025-01-15T10:30:00Z',
  antall_events: 4,
};

describe('View Components - Functional Tests', () => {
  describe('ComprehensiveMetadata', () => {
    it('should render sak ID', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getByText('SAK-2025-001')).toBeInTheDocument();
    });

    it('should render sakstittel', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(
        screen.getByText(/Endring av grunnforhold - Bjørvika Utbyggingsprosjekt/i)
      ).toBeInTheDocument();
    });

    it('should render overordnet status', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      // Now uses readable label instead of raw enum value
      expect(screen.getByText('Under behandling')).toBeInTheDocument();
    });

    it('should display prosjekt field', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getAllByText(/Prosjekt/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Sakstittel/i)).toBeInTheDocument();
    });

    it('should display entreprenør and byggherre', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getByText(/Entreprenør/i)).toBeInTheDocument();
      expect(screen.getByText(/Byggherre/i)).toBeInTheDocument();
    });

    it('should display opprettet field and status badge', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getByText(/Opprettet/i)).toBeInTheDocument();
      // Status is shown as a badge, not a label - "Under behandling" is tested in 'should render overordnet status'
      expect(screen.getByText(/Under behandling/i)).toBeInTheDocument();
    });

    it('should display sak-id', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getByText(/Sak-ID/i)).toBeInTheDocument();
      expect(screen.getByText(/SAK-2025-001/)).toBeInTheDocument();
    });
  });
});
