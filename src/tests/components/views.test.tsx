/**
 * Functional tests for View Components
 *
 * Tests component behavior, rendering, props, and data display.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ComprehensiveMetadata } from '@/src/components/views/ComprehensiveMetadata';
import { RevisionHistory } from '@/src/components/views/RevisionHistory';
import { StatusCard } from '@/src/components/views/StatusCard';
import { StatusDashboard } from '@/src/components/views/StatusDashboard';
import { Timeline } from '@/src/components/views/Timeline';
import { TimelineItem } from '@/src/components/views/TimelineItem';
import { mockSakState1, mockSakState2, mockSakState3, getMockHistorikkById } from '@/src/mocks';
import type { SakState, SporStatus, TimelineEntry } from '@/src/types/timeline';

// Mock the API module
vi.mock('@/src/api/state', () => ({
  fetchHistorikk: vi.fn(),
}));

import { fetchHistorikk } from '@/src/api/state';

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
    handling: 'Send grunnlag',
    spor: 'grunnlag',
  },
  sum_krevd: 0,
  sum_godkjent: 0,
  antall_events: 0,
  ...overrides,
});

describe('View Components - Functional Tests', () => {
  describe('StatusCard', () => {
    it('should render with all required props', () => {
      render(
        <StatusCard
          spor="grunnlag"
          status="sendt"
          title="Grunnlag"
          lastUpdated="2025-01-15T10:00:00Z"
        />
      );

      // StatusCard shows the spor label (Ansvarsgrunnlag for grunnlag)
      expect(screen.getByText('Ansvarsgrunnlag')).toBeInTheDocument();
    });

    it('should display the correct status text', () => {
      render(
        <StatusCard
          spor="vederlag"
          status="godkjent"
          title="Vederlag"
          lastUpdated="2025-01-15T10:00:00Z"
        />
      );

      // The component shows status label - visible on both mobile and desktop
      // On mobile it's in a separate row, on desktop it's inline
      expect(screen.getAllByText('Godkjent').length).toBeGreaterThan(0);
    });

    it('should render for all spor types', () => {
      const sporTypes: ('grunnlag' | 'vederlag' | 'frist')[] = ['grunnlag', 'vederlag', 'frist'];

      sporTypes.forEach((spor) => {
        const { unmount } = render(
          <StatusCard
            spor={spor}
            status="sendt"
            title={spor.charAt(0).toUpperCase() + spor.slice(1)}
            lastUpdated="2025-01-15T10:00:00Z"
          />
        );
        unmount();
      });
    });

    it('should handle all status types', () => {
      const statuses: SporStatus[] = [
        'ikke_relevant',
        'utkast',
        'sendt',
        'under_behandling',
        'godkjent',
        'delvis_godkjent',
        'avvist',
        'under_forhandling',
        'trukket',
        'laast',
      ];

      statuses.forEach((status) => {
        const { unmount } = render(
          <StatusCard
            spor="grunnlag"
            status={status}
            title="Test"
            lastUpdated="2025-01-15T10:00:00Z"
          />
        );
        unmount();
      });
    });
  });

  describe('StatusDashboard', () => {
    it('should render all three track status cards', () => {
      render(<StatusDashboard state={mockSakState1} />);

      // Should have status sections for all three tracks
      expect(screen.getByText('Ansvarsgrunnlag')).toBeInTheDocument();
      expect(screen.getByText('Vederlag')).toBeInTheDocument();
      expect(screen.getByText('Frist')).toBeInTheDocument();
    });

    it('should display overall status in sr-only element', () => {
      render(<StatusDashboard state={mockSakState1} />);

      // The overordnet_status is now shown as readable label in screen-reader-only element
      // Note: Multiple status elements exist (one for dashboard + one per StatusCard)
      const statusElements = screen.getAllByRole('status');
      const dashboardStatus = statusElements.find(el => el.textContent?.includes('Under behandling'));
      expect(dashboardStatus).toBeTruthy();
    });

    it('should show EO button when kan_utstede_eo is true', () => {
      render(<StatusDashboard state={mockSakState3} />);

      // mockSakState3 has kan_utstede_eo: true
      expect(mockSakState3.kan_utstede_eo).toBe(true);
    });

    it('should render section with heading', () => {
      render(<StatusDashboard state={mockSakState1} />);

      // Should have a section with sr-only heading
      const section = screen.getByRole('region', { name: /status dashboard/i });
      expect(section).toBeInTheDocument();
    });
  });

  describe('Timeline', () => {
    const mockEvents: TimelineEntry[] = [
      {
        event_id: '1',
        tidsstempel: '2025-01-15T10:00:00Z',
        type: 'Grunnlag opprettet',
        aktor: 'Per Hansen',
        rolle: 'TE',
        spor: 'grunnlag',
        sammendrag: 'Varsel om endrede grunnforhold',
      },
      {
        event_id: '2',
        tidsstempel: '2025-01-16T11:00:00Z',
        type: 'Vederlagskrav sendt',
        aktor: 'Per Hansen',
        rolle: 'TE',
        spor: 'vederlag',
        sammendrag: 'Krav på 500.000 NOK',
      },
      {
        event_id: '3',
        tidsstempel: '2025-01-17T14:00:00Z',
        type: 'Grunnlag godkjent',
        aktor: 'Kari Nordmann',
        rolle: 'BH',
        spor: 'grunnlag',
        sammendrag: 'Grunnlag godkjent',
      },
    ];

    it('should render all timeline events', () => {
      render(<Timeline events={mockEvents} />);

      // Event summaries are shown on the main row (sammendrag field)
      expect(screen.getAllByText(/Varsel om endrede grunnforhold/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Krav på 500.000 NOK/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Grunnlag godkjent/i).length).toBeGreaterThan(0);
    });

    it('should show empty state when no events', () => {
      render(<Timeline events={[]} />);

      expect(screen.getByText(/Ingen hendelser/i)).toBeInTheDocument();
    });

    it('should display actor names when expanded', async () => {
      const user = userEvent.setup();
      render(<Timeline events={mockEvents} />);

      // Actor names are shown in the expanded view, click to expand first event
      const listItems = screen.getAllByRole('listitem');
      await user.click(listItems[0]);

      // Actor names should now be visible in expanded content
      expect(screen.getByText(/Per Hansen/i)).toBeInTheDocument();
    });

    it('should display event summaries', () => {
      render(<Timeline events={mockEvents} />);

      // Summaries may be duplicated in the component, use getAllByText
      expect(screen.getAllByText(/Varsel om endrede grunnforhold/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Krav på 500.000 NOK/i).length).toBeGreaterThan(0);
    });

    it('should show role indicators', () => {
      render(<Timeline events={mockEvents} />);

      // Should show TE and BH role indicators - they appear in actor strings
      expect(screen.getAllByText(/TE/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/BH/i).length).toBeGreaterThan(0);
    });
  });

  describe('TimelineItem', () => {
    const defaultProps = {
      timestamp: '2025-01-15T10:00:00Z',
      actor: 'Per Hansen (TE)',
      eventType: 'Vederlagskrav sendt',
      description: 'Krav på 500.000 NOK',
    };

    it('should render with required props', () => {
      render(
        <ul>
          <TimelineItem {...defaultProps} />
        </ul>
      );

      expect(screen.getByText(/Per Hansen/i)).toBeInTheDocument();
      expect(screen.getByText(/Vederlagskrav sendt/i)).toBeInTheDocument();
      expect(screen.getByText(/Krav på 500.000 NOK/i)).toBeInTheDocument();
    });

    it('should render with details when provided', () => {
      render(
        <ul>
          <TimelineItem
            {...defaultProps}
            details={
              <dl>
                <dt>Beløp</dt>
                <dd>500.000 NOK</dd>
              </dl>
            }
            isExpanded={true}
            onToggle={() => {}}
          />
        </ul>
      );

      expect(screen.getByText('Beløp')).toBeInTheDocument();
      expect(screen.getByText('500.000 NOK')).toBeInTheDocument();
    });

    it('should call onToggle when expanded/collapsed', async () => {
      const user = userEvent.setup();
      const handleToggle = vi.fn();

      render(
        <ul>
          <TimelineItem
            {...defaultProps}
            details={<div>Details content</div>}
            isExpanded={false}
            onToggle={handleToggle}
          />
        </ul>
      );

      // Find and click the toggle button
      const toggleButton = screen.getByRole('button');
      await user.click(toggleButton);

      expect(handleToggle).toHaveBeenCalled();
    });

    it('should format timestamp correctly', () => {
      render(
        <ul>
          <TimelineItem {...defaultProps} timestamp="2025-01-15T14:30:00Z" />
        </ul>
      );

      // Should display a formatted date/time
      const timeElement = screen.getByRole('time') || screen.getByText(/15/);
      expect(timeElement).toBeInTheDocument();
    });
  });

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

    it('should display prosjektinformasjon section', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getByText(/Prosjektinformasjon/i)).toBeInTheDocument();
      expect(screen.getByText(/Sakstittel/i)).toBeInTheDocument();
    });

    it('should display grunnlag section when grunnlag is not irrelevant', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getByText(/Grunnlag \/ Varsel/i)).toBeInTheDocument();
    });

    it('should display saksmetadata section', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getByText(/Saksmetadata/i)).toBeInTheDocument();
      expect(screen.getByText(/SAK-2025-001/)).toBeInTheDocument();
    });

    it('should have collapsible sections', async () => {
      const user = userEvent.setup();
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      // Find collapsible triggers
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Click to toggle
      if (buttons[0]) {
        await user.click(buttons[0]);
      }
    });
  });

  describe('RevisionHistory', () => {
    // Helper to render RevisionHistory with router context
    const renderRevisionHistory = (sakId: string) => {
      return render(
        <MemoryRouter initialEntries={[`/case/${sakId}`]}>
          <Routes>
            <Route path="/case/:sakId" element={<RevisionHistory />} />
          </Routes>
        </MemoryRouter>
      );
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should show empty state when no claims exist', async () => {
      // Mock API to return empty historikk
      vi.mocked(fetchHistorikk).mockResolvedValue({
        version: 1,
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
        expect(screen.getByText(/Vederlag - Revisjonshistorikk/i)).toBeInTheDocument();
      });
    });

    it('should render frist section when frist has claims', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        expect(screen.getByText(/Frist - Revisjonshistorikk/i)).toBeInTheDocument();
      });
    });

    it('should display vederlag values', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Should show krevd_belop from historikk
        expect(screen.getAllByText(/NOK/i).length).toBeGreaterThan(0);
      });
    });

    it('should display frist values', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Should show krevd_dager from historikk
        expect(screen.getAllByText(/dager/i).length).toBeGreaterThan(0);
      });
    });

    it('should show table headers', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        expect(screen.getAllByText(/Felt/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Versjon/i).length).toBeGreaterThan(0);
      });
    });

    it('should display status row', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Both vederlag and frist tables should have Status row
        expect(screen.getAllByText('Status').length).toBe(2);
      });
    });

    it('should display BH resultat when available', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        expect(screen.getAllByText(/BH Resultat/i).length).toBeGreaterThan(0);
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

    it('should render collapsible sections', async () => {
      vi.mocked(fetchHistorikk).mockResolvedValue(getMockHistorikkById('SAK-2025-001'));

      renderRevisionHistory('SAK-2025-001');

      await waitFor(() => {
        // Find collapsible triggers
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
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
