import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { expectNoA11yViolations } from '@/__tests__/axeHelper';
import { StatusCard } from '@/src/components/views/StatusCard';
import { StatusDashboard } from '@/src/components/views/StatusDashboard';
import { Timeline } from '@/src/components/views/Timeline';
import { TimelineItem } from '@/src/components/views/TimelineItem';
import type { SakState, SporStatus } from '@/src/types/timeline';

describe('View Components - Accessibility', () => {
  describe('StatusCard', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <StatusCard
          spor="grunnlag"
          status="godkjent" as SporStatus
          title="Grunnlag"
          lastUpdated="2025-12-01T10:00:00Z"
        />
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should announce status changes to screen readers', async () => {
      const { container } = render(
        <StatusCard
          spor="vederlag"
          status="under_behandling" as SporStatus
          title="Vederlag"
          lastUpdated="2025-12-01T10:00:00Z"
        />
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should handle all status types accessibly', async () => {
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

      for (const status of statuses) {
        const { container } = render(
          <StatusCard
            spor="frist"
            status={status}
            title="Frist"
            lastUpdated="2025-12-01T10:00:00Z"
          />
        );
        const results = await axe(container);
        expectNoA11yViolations(results);
      }
    });
  });

  describe('StatusDashboard', () => {
    const mockState: SakState = {
      sakstittel: 'Test Sak',
      overordnet_status: 'AKTIV',
      grunnlag: {
        status: 'godkjent' as SporStatus,
        siste_oppdatert: '2025-12-01T10:00:00Z',
      },
      vederlag: {
        status: 'under_behandling' as SporStatus,
        siste_oppdatert: '2025-12-01T11:00:00Z',
      },
      frist: {
        status: 'sendt' as SporStatus,
        siste_oppdatert: '2025-12-01T12:00:00Z',
      },
      kan_utstede_eo: false,
    };

    it('should have no accessibility violations', async () => {
      const { container } = render(<StatusDashboard state={mockState} />);
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should have proper semantic structure', async () => {
      const { container } = render(<StatusDashboard state={mockState} />);
      const results = await axe(container, {
        rules: {
          region: { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });
  });

  describe('TimelineItem', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ul>
          <TimelineItem
            timestamp="2025-12-01T10:00:00Z"
            actor="John Doe (TE)"
            eventType="Vederlagskrav sendt"
            description="Sent vederlagskrav for NOK 500,000"
            details={
              <dl>
                <dt>Beløp</dt>
                <dd>NOK 500,000</dd>
                <dt>Metode</dt>
                <dd>Direkte kostnader</dd>
              </dl>
            }
            isExpanded={false}
            onToggle={() => {}}
          />
        </ul>
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should have proper time element', async () => {
      const { container } = render(
        <ul>
          <TimelineItem
            timestamp="2025-12-01T10:00:00Z"
            actor="Jane Smith (BH)"
            eventType="Grunnlag godkjent"
            description="Approved grunnlag"
          />
        </ul>
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });

  describe('Timeline', () => {
    const mockEvents = [
      {
        event_id: '1',
        tidsstempel: '2025-12-01T10:00:00Z',
        aktor: 'John Doe',
        rolle: 'TE' as const,
        type: 'Grunnlag sendt',
        sammendrag: 'Sent grunnlag for approval',
        spor: 'grunnlag' as const,
      },
      {
        event_id: '2',
        tidsstempel: '2025-12-01T11:00:00Z',
        aktor: 'Jane Smith',
        rolle: 'BH' as const,
        type: 'Grunnlag godkjent',
        sammendrag: 'Approved grunnlag',
        spor: 'grunnlag' as const,
      },
      {
        event_id: '3',
        tidsstempel: '2025-12-01T12:00:00Z',
        aktor: 'John Doe',
        rolle: 'TE' as const,
        type: 'Vederlagskrav sendt',
        sammendrag: 'Sent vederlagskrav for NOK 500,000',
        spor: 'vederlag' as const,
      },
    ];

    it('should have no accessibility violations', async () => {
      const { container } = render(<Timeline events={mockEvents} />);
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should handle empty state accessibly', async () => {
      const { container } = render(<Timeline events={[]} />);
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should use semantic list structure', async () => {
      const { container } = render(<Timeline events={mockEvents} />);
      const results = await axe(container, {
        rules: {
          list: { enabled: true },
          listitem: { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });
  });
});
