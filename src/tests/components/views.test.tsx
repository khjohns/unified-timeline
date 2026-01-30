/**
 * Functional tests for View Components
 *
 * Tests component behavior, rendering, props, and data display.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComprehensiveMetadata } from '@/components/views/ComprehensiveMetadata';
import { RevisionHistory } from '@/components/views/RevisionHistory';
import { mockSakState1, mockSakState2, mockSakState3, getMockHistorikkById } from '@mocks';
import type { SakState, SporStatus } from '@/types/timeline';

// Mock the API module
vi.mock('@/api/state', () => ({
  fetchHistorikk: vi.fn(),
}));

import { fetchHistorikk } from '@/api/state';

// Create a minimal mock state for testing
const createMinimalState = (overrides: Partial<SakState> = {}): SakState => ({
  sak_id: 'TEST-001',
  sakstittel: 'Test Case',
  grunnlag: {
    status: 'utkast',
    kontraktsreferanser: [],
    laast: false,
    antall_versjoner: 0,
    ...overrides.grunnlag,
  },
  vederlag: {
    status: 'utkast',
    antall_versjoner: 0,
    ...overrides.vederlag,
  },
  frist: {
    status: 'utkast',
    antall_versjoner: 0,
    ...overrides.frist,
  },
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: '',
  visningsstatus_frist: '',
  overordnet_status: 'UTKAST',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'TE',
    handling: 'Varsle endringsforhold',
    spor: 'grunnlag',
  },
  sum_krevd: 0,
  sum_godkjent: 0,
  antall_events: 0,
  ...overrides,
});

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

  describe('RevisionHistory', () => {
    // Helper to render RevisionHistory with router and query context
    const renderRevisionHistory = (sakId: string) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      return render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/case/${sakId}`]}>
            <Routes>
              <Route path="/case/:sakId" element={<RevisionHistory />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should show empty state when no claims exist', async () => {
      // Mock API to return empty historikk
      vi.mocked(fetchHistorikk).mockResolvedValue({
        version: 1,
        grunnlag: [],
        vederlag: [],
        frist: [],
      });

      renderRevisionHistory('SAK-EMPTY');

      await waitFor(() => {
        expect(screen.getByText(/Ingen krav er fremsatt ennå/i)).toBeInTheDocument();
      });
    });

    it('should render vederlag section when vederlag has claims', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Vederlag/i })).toBeInTheDocument();
      });
    });

    it('should render frist section when frist has claims', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Frist/i })).toBeInTheDocument();
      });
    });

    it('should display vederlag values', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Should show Beløp row in table
        expect(screen.getByText('Beløp')).toBeInTheDocument();
      });
    });

    it('should display frist values', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Should show Antall dager row in table
        expect(screen.getByText('Antall dager')).toBeInTheDocument();
      });
    });

    it('should show table headers', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Should have Felt column header and version headers
        expect(screen.getAllByText(/Felt/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Opprinnelig|Rev\./i).length).toBeGreaterThan(0);
      });
    });

    it('should display resultat row', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Both vederlag and frist tables should have Resultat row
        expect(screen.getAllByText('Resultat').length).toBe(2);
      });
    });

    it('should display respons section', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Both tables should have Respons (BH) group header
        expect(screen.getAllByText(/Respons \(BH\)/i).length).toBe(2);
      });
    });

    it('should highlight godkjent values', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Godkjent beløp and Godkjent dager rows should be in the table
        expect(screen.getByText(/Godkjent beløp/i)).toBeInTheDocument();
        expect(screen.getByText(/Godkjent dager/i)).toBeInTheDocument();
      });
    });

    it('should display krav section', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Both tables should have Krav (TE) group header
        expect(screen.getAllByText(/Krav \(TE\)/i).length).toBe(2);
      });
    });

    it('should show loading state initially', () => {
      // Mock API to never resolve
      vi.mocked(fetchHistorikk).mockImplementation(() => new Promise(() => {}));

      renderRevisionHistory('SAK-2025-001');

      expect(screen.getByText(/Laster revisjonshistorikk/i)).toBeInTheDocument();
    });

    it('should show error state on API failure', async () => {
      vi.mocked(fetchHistorikk).mockRejectedValue(new Error('API Error'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        expect(screen.getByText(/Kunne ikke laste revisjonshistorikk/i)).toBeInTheDocument();
      });
    });
  });
});
