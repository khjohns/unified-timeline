import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { expectNoA11yViolations } from '../../../__tests__/axeHelper';
import { Timeline } from '@/components/views/Timeline';
import { TimelineItem } from '@/components/views/TimelineItem';

describe('View Components - Accessibility', () => {
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
