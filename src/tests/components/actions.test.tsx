/**
 * Functional tests for Action/Modal Components
 *
 * Tests basic rendering and structure of modal components.
 * Note: Form validation and submission tests are in integration tests
 * due to React Query and complex mocking requirements.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RespondGrunnlagModal } from '@/src/components/actions/RespondGrunnlagModal';
import { RespondVederlagModal } from '@/src/components/actions/RespondVederlagModal';
import { RespondFristModal } from '@/src/components/actions/RespondFristModal';

// Wrapper with React Query provider
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('Action/Modal Components - Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RespondGrunnlagModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
    };

    it('should render when open', () => {
      renderWithQueryClient(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Respons på grunnlag/i)).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithQueryClient(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<RespondGrunnlagModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Respons på grunnlag/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Avbryt/i)).toBeInTheDocument();
      expect(screen.getByText(/Send respons/i)).toBeInTheDocument();
    });
  });

  describe('RespondVederlagModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
    };

    it('should render when open', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Respons på vederlag/i)).toBeInTheDocument();
    });

    it('should have amount fields', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} />);

      // Should have field for godkjent beløp
      expect(screen.getByText(/Godkjent beløp/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Respons på vederlag/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Avbryt/i)).toBeInTheDocument();
      expect(screen.getByText(/Send respons/i)).toBeInTheDocument();
    });
  });

  describe('RespondFristModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
    };

    it('should render when open', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} />);

      expect(screen.getByText(/Respons på frist/i)).toBeInTheDocument();
    });

    it('should have days field', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} />);

      // Should have field for godkjent dager
      expect(screen.getByText(/Godkjent dager/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Respons på frist/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} />);

      expect(screen.getByText(/Avbryt/i)).toBeInTheDocument();
      expect(screen.getByText(/Send respons/i)).toBeInTheDocument();
    });
  });

  describe('Modal close behavior', () => {
    it('should call onOpenChange when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const handleOpenChange = vi.fn();

      renderWithQueryClient(
        <RespondGrunnlagModal open={true} onOpenChange={handleOpenChange} sakId="TEST-001" />
      );

      await user.click(screen.getByText(/Avbryt/i));
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
