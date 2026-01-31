/**
 * Functional tests for View Components
 *
 * Tests component behavior, rendering, props, and data display.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComprehensiveMetadata } from '@/components/views/ComprehensiveMetadata';
import { mockSakState1 } from '@mocks';
import type { SakState, SporStatus } from '@/types/timeline';

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
