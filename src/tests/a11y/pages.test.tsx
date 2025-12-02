import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { expectNoA11yViolations } from '@/__tests__/axeHelper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { CasePage } from '@/src/pages/CasePage';
import { ComponentShowcase } from '@/src/pages/ComponentShowcase';

// Mock the useCaseState hook
vi.mock('@/src/hooks/useCaseState', () => ({
  useCaseState: () => ({
    data: {
      state: {
        sakstittel: 'Test Sak - Accessibility Test',
        overordnet_status: 'AKTIV',
        grunnlag: {
          status: 'godkjent',
          siste_oppdatert: '2025-12-01T10:00:00Z',
        },
        vederlag: {
          status: 'under_behandling',
          siste_oppdatert: '2025-12-01T11:00:00Z',
        },
        frist: {
          status: 'sendt',
          siste_oppdatert: '2025-12-01T12:00:00Z',
        },
        kan_utstede_eo: false,
      },
      events: [
        {
          id: '1',
          timestamp: '2025-12-01T10:00:00Z',
          actor: 'John Doe (TE)',
          eventType: 'Grunnlag sendt',
          description: 'Sent grunnlag for approval',
        },
        {
          id: '2',
          timestamp: '2025-12-01T11:00:00Z',
          actor: 'Jane Smith (BH)',
          eventType: 'Grunnlag godkjent',
          description: 'Approved grunnlag',
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ sakId: 'test-sak-123' }),
  };
});

// Helper to create test wrapper with all providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Pages - Accessibility', () => {
  describe('CasePage', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<CasePage />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should have proper page structure with landmarks', async () => {
      const { container } = render(<CasePage />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container, {
        rules: {
          region: { enabled: true },
          landmark: { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });

    it('should have proper heading hierarchy', async () => {
      const { container } = render(<CasePage />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container, {
        rules: {
          'heading-order': { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });

    it('should have accessible navigation', async () => {
      const { container } = render(<CasePage />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container, {
        rules: {
          'link-name': { enabled: true },
          'button-name': { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });
  });

  describe('ComponentShowcase', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<ComponentShowcase />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should showcase all components accessibly', async () => {
      const { container } = render(<ComponentShowcase />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });
  });

  describe('Loading and Error States', () => {
    it('should handle loading state accessibly', async () => {
      vi.mock('@/hooks/useCaseState', () => ({
        useCaseState: () => ({
          data: null,
          isLoading: true,
          error: null,
        }),
      }));

      const { container } = render(<CasePage />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should handle error state accessibly', async () => {
      vi.mock('@/hooks/useCaseState', () => ({
        useCaseState: () => ({
          data: null,
          isLoading: false,
          error: new Error('Failed to load case'),
        }),
      }));

      const { container } = render(<CasePage />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container, {
        rules: {
          'aria-allowed-role': { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility on mobile viewport', async () => {
      // Set viewport to mobile size
      global.innerWidth = 375;
      global.innerHeight = 667;

      const { container } = render(<CasePage />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should maintain accessibility on tablet viewport', async () => {
      // Set viewport to tablet size
      global.innerWidth = 768;
      global.innerHeight = 1024;

      const { container } = render(<CasePage />, {
        wrapper: createWrapper(),
      });
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });
});
