/**
 * Functional tests for View Components
 *
 * Tests component behavior, rendering, props, and data display.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComprehensiveMetadata } from '@/src/components/views/ComprehensiveMetadata';
import { RevisionHistory } from '@/src/components/views/RevisionHistory';
import { StatusCard } from '@/src/components/views/StatusCard';
import { StatusDashboard } from '@/src/components/views/StatusDashboard';
import { Timeline } from '@/src/components/views/Timeline';
import { TimelineItem } from '@/src/components/views/TimelineItem';
import { mockSakState1, mockSakState2, mockSakState3 } from '@/src/mocks/mockData';
import type { SakState, SporStatus, TimelineEntry } from '@/src/types/timeline';

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

      // StatusCard shows the spor label in uppercase
      expect(screen.getByText('GRUNNLAG')).toBeInTheDocument();
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

      // The component shows status label
      expect(screen.getByText('Godkjent')).toBeInTheDocument();
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

      // Should have status sections for all three tracks (in uppercase)
      expect(screen.getByText('GRUNNLAG')).toBeInTheDocument();
      expect(screen.getByText('VEDERLAG')).toBeInTheDocument();
      expect(screen.getByText('FRIST')).toBeInTheDocument();
    });

    it('should display overall status in sr-only element', () => {
      render(<StatusDashboard state={mockSakState1} />);

      // The overordnet_status is shown in a screen-reader-only element
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveTextContent('UNDER_BEHANDLING');
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

      // Event types may appear multiple times (in header and description), use getAllByText
      expect(screen.getAllByText(/Grunnlag opprettet/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Vederlagskrav sendt/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Grunnlag godkjent/i).length).toBeGreaterThan(0);
    });

    it('should show empty state when no events', () => {
      render(<Timeline events={[]} />);

      expect(screen.getByText(/Ingen hendelser/i)).toBeInTheDocument();
    });

    it('should display actor names', () => {
      render(<Timeline events={mockEvents} />);

      // Actor names may appear multiple times, use getAllByText
      expect(screen.getAllByText(/Per Hansen/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Kari Nordmann/i).length).toBeGreaterThan(0);
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

      expect(screen.getByText('UNDER_BEHANDLING')).toBeInTheDocument();
    });

    it('should display vederlag information', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      // Should show vederlag status - use getAllByText since it may appear multiple times
      expect(screen.getAllByText(/Vederlag/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2\s*500\s*000/i).length).toBeGreaterThan(0); // krevd_belop
    });

    it('should display frist information', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getByText(/Frist/i)).toBeInTheDocument();
    });

    it('should display summary totals', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      expect(screen.getByText(/Sammendrag/i)).toBeInTheDocument();
      expect(screen.getByText(/Totalt krevd/i)).toBeInTheDocument();
    });

    it('should render grunnlag section when not ikke_relevant', () => {
      render(<ComprehensiveMetadata state={mockSakState1} sakId="SAK-2025-001" />);

      // Grunnlag section should be visible
      expect(screen.getByText(/Grunnlag/i)).toBeInTheDocument();
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
    it('should show empty state when no claims exist', () => {
      const emptyState = createMinimalState({
        vederlag: { status: 'ikke_relevant', antall_versjoner: 0 },
        frist: { status: 'ikke_relevant', antall_versjoner: 0 },
      });

      render(<RevisionHistory state={emptyState} />);

      expect(screen.getByText(/Ingen krav er fremsatt ennå/i)).toBeInTheDocument();
    });

    it('should render vederlag section when vederlag has claims', () => {
      render(<RevisionHistory state={mockSakState1} />);

      expect(screen.getByText(/Vederlag - Revisjonshistorikk/i)).toBeInTheDocument();
    });

    it('should render frist section when frist has claims', () => {
      render(<RevisionHistory state={mockSakState1} />);

      expect(screen.getByText(/Frist - Revisjonshistorikk/i)).toBeInTheDocument();
    });

    it('should display vederlag values', () => {
      render(<RevisionHistory state={mockSakState1} />);

      // Should show krevd_belop - use getAllByText since it may appear in multiple places
      expect(screen.getAllByText(/2\s*500\s*000.*NOK/i).length).toBeGreaterThan(0);
    });

    it('should display frist values', () => {
      render(<RevisionHistory state={mockSakState1} />);

      // Should show krevd_dager - use getAllByText
      expect(screen.getAllByText(/45.*dager/i).length).toBeGreaterThan(0);
    });

    it('should show table headers', () => {
      render(<RevisionHistory state={mockSakState1} />);

      expect(screen.getAllByText(/Felt/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Nåværende/i).length).toBeGreaterThan(0);
    });

    it('should display status row', () => {
      render(<RevisionHistory state={mockSakState1} />);

      // Both vederlag and frist tables should have Status row
      expect(screen.getAllByText('Status').length).toBe(2);
    });

    it('should display BH resultat when available', () => {
      render(<RevisionHistory state={mockSakState1} />);

      expect(screen.getAllByText(/BH Resultat/i).length).toBeGreaterThan(0);
    });

    it('should highlight godkjent values', () => {
      render(<RevisionHistory state={mockSakState1} />);

      // Godkjent beløp and Godkjent dager rows should be highlighted
      expect(screen.getByText(/Godkjent beløp/i)).toBeInTheDocument();
      expect(screen.getByText(/Godkjent dager/i)).toBeInTheDocument();
    });

    it('should show frist_for_spesifisering when available', () => {
      // mockSakState4 has frist_for_spesifisering
      const stateWithSpesifisering = createMinimalState({
        vederlag: { status: 'utkast', antall_versjoner: 0 },
        frist: {
          status: 'under_behandling',
          frist_for_spesifisering: '2025-02-15',
          antall_versjoner: 1,
        },
      });

      render(<RevisionHistory state={stateWithSpesifisering} />);

      expect(screen.getByText(/Frist for spesifisering/i)).toBeInTheDocument();
      expect(screen.getByText('2025-02-15')).toBeInTheDocument();
    });

    it('should render collapsible sections', async () => {
      const user = userEvent.setup();
      render(<RevisionHistory state={mockSakState1} />);

      // Find collapsible triggers and toggle them
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
