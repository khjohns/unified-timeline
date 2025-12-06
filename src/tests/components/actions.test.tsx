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
import { SendGrunnlagModal } from '@/src/components/actions/SendGrunnlagModal';
import { SendVederlagModal } from '@/src/components/actions/SendVederlagModal';
import { SendFristModal } from '@/src/components/actions/SendFristModal';

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

      expect(screen.getByText(/Svar på grunnlag/i)).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithQueryClient(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<RespondGrunnlagModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Svar på grunnlag/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Avbryt/i)).toBeInTheDocument();
      expect(screen.getByText(/Send svar/i)).toBeInTheDocument();
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

      expect(screen.getByText(/Svar på vederlagskrav/i)).toBeInTheDocument();
    });

    it('should have amount fields', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} />);

      // Should have field for resultat (vederlagsberegning)
      expect(screen.getByText(/Resultat \(vederlagsberegning\)/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Svar på vederlagskrav/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Avbryt/i)).toBeInTheDocument();
      expect(screen.getByText(/Send svar/i)).toBeInTheDocument();
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

      expect(screen.getByText(/Svar på fristkrav/i)).toBeInTheDocument();
    });

    it('should have days field', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} />);

      // Should have field for resultat (fristberegning)
      expect(screen.getByText(/Resultat \(fristberegning\)/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Svar på fristkrav/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} />);

      expect(screen.getByText(/Avbryt/i)).toBeInTheDocument();
      expect(screen.getByText(/Send svar/i)).toBeInTheDocument();
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

  describe('SendGrunnlagModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
    };

    it('should render when open', () => {
      renderWithQueryClient(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Send grunnlag/i })).toBeInTheDocument();
    });

    it('should have hovedkategori field', () => {
      renderWithQueryClient(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Hovedkategori \(NS 8407\)/i)).toBeInTheDocument();
    });

    it('should have tittel field', () => {
      renderWithQueryClient(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Tittel på varselet/i)).toBeInTheDocument();
    });

    it('should have beskrivelse field', () => {
      renderWithQueryClient(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Beskrivelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<SendGrunnlagModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Send grunnlag/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send grunnlag/i })).toBeInTheDocument();
    });
  });

  describe('SendVederlagModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      grunnlagEventId: 'grunnlag-1',
    };

    it('should render when open', () => {
      renderWithQueryClient(<SendVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Krav om Vederlagsjustering/i)).toBeInTheDocument();
    });

    it('should have beregningsmetode field', () => {
      renderWithQueryClient(<SendVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Beregningsmetode/i)).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithQueryClient(<SendVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse\/Dokumentasjon/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<SendVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Krav om Vederlagsjustering/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<SendVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Avbryt/i)).toBeInTheDocument();
      expect(screen.getByText(/Send Krav/i)).toBeInTheDocument();
    });
  });

  describe('SendFristModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      grunnlagEventId: 'grunnlag-1',
    };

    it('should render when open', () => {
      renderWithQueryClient(<SendFristModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Send fristkrav/i })).toBeInTheDocument();
    });

    it('should have varsel type field', () => {
      renderWithQueryClient(<SendFristModal {...defaultProps} />);

      expect(screen.getByText(/Type varsel\/krav/i)).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithQueryClient(<SendFristModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse for fristforlengelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<SendFristModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Send fristkrav/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<SendFristModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send fristkrav/i })).toBeInTheDocument();
    });
  });
});
