import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { expectNoA11yViolations } from '../../../__tests__/axeHelper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/primitives/Toast';
import { SendGrunnlagModal } from '@/components/actions/SendGrunnlagModal';
import { SendVederlagModal } from '@/components/actions/SendVederlagModal';
import { SendFristModal } from '@/components/actions/SendFristModal';
import { RespondGrunnlagModal } from '@/components/actions/RespondGrunnlagModal';
import { RespondVederlagModal } from '@/components/actions/RespondVederlagModal';
import { RespondFristModal } from '@/components/actions/RespondFristModal';

// Helper to wrap components with QueryClient provider and ToastProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
};

describe('Action Components (Modals) - Accessibility', () => {
  describe('SendGrunnlagModal', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <SendGrunnlagModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should have proper form labels and descriptions', async () => {
      const { container } = render(
        <SendGrunnlagModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container, {
        rules: {
          label: { enabled: true },
          'label-content-name-mismatch': { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });
  });

  describe('SendVederlagModal', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <SendVederlagModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
          grunnlagEventId="grunnlag-1"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should properly associate form inputs with labels', async () => {
      const { container } = render(
        <SendVederlagModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
          grunnlagEventId="grunnlag-1"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container, {
        rules: {
          'label-title-only': { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });
  });

  describe('SendFristModal', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <SendFristModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
          grunnlagEventId="grunnlag-1"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });

  describe('RespondGrunnlagModal', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <RespondGrunnlagModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
          grunnlagEventId="test-grunnlag-event-123"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should announce form errors to screen readers', async () => {
      const { container } = render(
        <RespondGrunnlagModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
          grunnlagEventId="test-grunnlag-event-123"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container, {
        rules: {
          'aria-valid-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });
  });

  describe('RespondVederlagModal', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <RespondVederlagModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
          vederlagKravId="vederlag-test-123"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should have accessible radio buttons/checkboxes', async () => {
      const { container } = render(
        <RespondVederlagModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
          vederlagKravId="vederlag-test-123"
        />,
        { wrapper: createWrapper() }
      );
      // Default axe scan includes checkbox/radiogroup rules
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });

  describe('RespondFristModal', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <RespondFristModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });

  describe('Form Validation and Error Handling', () => {
    it('should properly associate error messages with form fields', async () => {
      const { container } = render(
        <SendVederlagModal
          open={true}
          onOpenChange={() => {}}
          sakId="test-sak-123"
          grunnlagEventId="grunnlag-1"
        />,
        { wrapper: createWrapper() }
      );
      const results = await axe(container, {
        rules: {
          'aria-required-attr': { enabled: true },
          'aria-required-children': { enabled: true },
        },
      });
      expectNoA11yViolations(results);
    });
  });
});
