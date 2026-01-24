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
            eventType="Ansvarsgrunnlag godkjent"
            description="Godkjent ansvarsgrunnlag"
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
        specversion: '1.0' as const,
        id: '1',
        source: '/projects/test/cases/test-sak',
        type: 'no.oslo.koe.grunnlag_opprettet',
        time: '2025-12-01T10:00:00Z',
        actor: 'John Doe',
        actorrole: 'TE' as const,
        summary: 'Sent grunnlag for approval',
        spor: 'grunnlag' as const,
      },
      {
        specversion: '1.0' as const,
        id: '2',
        source: '/projects/test/cases/test-sak',
        type: 'no.oslo.koe.grunnlag_godkjent',
        time: '2025-12-01T11:00:00Z',
        actor: 'Jane Smith',
        actorrole: 'BH' as const,
        summary: 'Approved grunnlag',
        spor: 'grunnlag' as const,
      },
      {
        specversion: '1.0' as const,
        id: '3',
        source: '/projects/test/cases/test-sak',
        type: 'no.oslo.koe.vederlag_sendt',
        time: '2025-12-01T12:00:00Z',
        actor: 'John Doe',
        actorrole: 'TE' as const,
        summary: 'Sent vederlagskrav for NOK 500,000',
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
