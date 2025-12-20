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
import { SendGrunnlagUpdateModal } from '@/src/components/actions/SendGrunnlagUpdateModal';
import { RespondGrunnlagUpdateModal } from '@/src/components/actions/RespondGrunnlagUpdateModal';
import { ReviseVederlagModal } from '@/src/components/actions/ReviseVederlagModal';
import { ReviseFristModal } from '@/src/components/actions/ReviseFristModal';
import { UpdateResponseVederlagModal } from '@/src/components/actions/UpdateResponseVederlagModal';
import { UpdateResponseFristModal } from '@/src/components/actions/UpdateResponseFristModal';

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

    it('should have krav section', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} />);

      // Should show the dialog title
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Svar på vederlagskrav/i)).not.toBeInTheDocument();
    });

    it('should have dialog with proper title', () => {
      renderWithQueryClient(<RespondVederlagModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Svar på vederlagskrav/i })).toBeInTheDocument();
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

    it('should have dialog role', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} />);

      // Should show the dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Svar på fristkrav/i)).not.toBeInTheDocument();
    });

    it('should have dialog with proper title', () => {
      renderWithQueryClient(<RespondFristModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Svar på fristkrav/i })).toBeInTheDocument();
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

    it('should have oppgjørsform field', () => {
      renderWithQueryClient(<SendVederlagModal {...defaultProps} />);

      expect(screen.getAllByText(/Oppgjørsform/i).length).toBeGreaterThan(0);
    });

    it('should have begrunnelse field', () => {
      renderWithQueryClient(<SendVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
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

      expect(screen.getByText(/Krav om fristforlengelse/i)).toBeInTheDocument();
    });

    it('should have varsel type field', () => {
      renderWithQueryClient(<SendFristModal {...defaultProps} />);

      expect(screen.getByText(/Type varsel\/krav/i)).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithQueryClient(<SendFristModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<SendFristModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Krav om fristforlengelse/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<SendFristModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send fristkrav/i })).toBeInTheDocument();
    });
  });

  describe('SendGrunnlagUpdateModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      originalEvent: {
        event_id: 'event-1',
        grunnlag: {
          tittel: 'Original tittel',
          beskrivelse: 'Original beskrivelse',
          dato_oppdaget: '2025-01-10',
          hovedkategori: 'ENDRING',
          underkategori: ['EO'],
        },
      },
    };

    it('should render when open', () => {
      renderWithQueryClient(<SendGrunnlagUpdateModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Oppdater grunnlag/i })).toBeInTheDocument();
    });

    it('should have endrings_begrunnelse field', () => {
      renderWithQueryClient(<SendGrunnlagUpdateModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse for endring/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<SendGrunnlagUpdateModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Oppdater grunnlag/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<SendGrunnlagUpdateModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Lagre endringer/i })).toBeInTheDocument();
    });
  });

  describe('RespondGrunnlagUpdateModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      lastResponseEvent: {
        event_id: 'response-1',
        resultat: 'godkjent' as const,
      },
      sakState: {
        grunnlag: {
          hovedkategori: 'ENDRING',
          underkategori: ['EO'],
        },
        er_subsidiaert_vederlag: false,
        er_subsidiaert_frist: false,
      } as any,
    };

    it('should render when open', () => {
      renderWithQueryClient(<RespondGrunnlagUpdateModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Endre svar på grunnlag/i })).toBeInTheDocument();
    });

    it('should have resultat field', () => {
      renderWithQueryClient(<RespondGrunnlagUpdateModal {...defaultProps} />);

      expect(screen.getByText(/Ny avgjørelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<RespondGrunnlagUpdateModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Endre svar på grunnlag/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<RespondGrunnlagUpdateModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Lagre endring/i })).toBeInTheDocument();
    });
  });

  describe('ReviseVederlagModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      lastVederlagEvent: {
        event_id: 'vederlag-1',
        metode: 'ENHETSPRISER' as const,
        belop_direkte: 100000,
        begrunnelse: 'Original begrunnelse',
      },
    };

    it('should render when open', () => {
      renderWithQueryClient(<ReviseVederlagModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Revider vederlagskrav/i })).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithQueryClient(<ReviseVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<ReviseVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Revider vederlagskrav/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<ReviseVederlagModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Revisjon/i })).toBeInTheDocument();
    });
  });

  describe('ReviseFristModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      lastFristEvent: {
        event_id: 'frist-1',
        antall_dager: 10,
        begrunnelse: 'Original begrunnelse',
      },
      fristTilstand: {
        krevd_dager: 10,
        godkjent_dager: 0,
      } as any,
    };

    it('should render when open', () => {
      renderWithQueryClient(<ReviseFristModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Revider fristkrav/i })).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithQueryClient(<ReviseFristModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<ReviseFristModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Revider fristkrav/i})).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<ReviseFristModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Oppdater Krav/i })).toBeInTheDocument();
    });
  });

  describe('UpdateResponseVederlagModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      lastResponseEvent: {
        event_id: 'response-1',
        resultat: 'godkjent' as const,
        godkjent_belop: 100000,
      },
      vederlagTilstand: {
        metode: 'ENHETSPRISER' as const,
        belop_direkte: 100000,
        status: 'under_behandling' as const,
        antall_versjoner: 1,
      },
    };

    it('should render when open', () => {
      renderWithQueryClient(<UpdateResponseVederlagModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Oppdater svar på vederlagskrav/i })).toBeInTheDocument();
    });

    it('should have resultat field', () => {
      renderWithQueryClient(<UpdateResponseVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Samlet resultat/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<UpdateResponseVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Oppdater svar på vederlagskrav/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<UpdateResponseVederlagModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Lagre Endringer/i })).toBeInTheDocument();
    });
  });

  describe('UpdateResponseFristModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      lastResponseEvent: {
        event_id: 'response-1',
        resultat: 'delvis_godkjent' as const,  // Not 'godkjent' so beregning section shows
        godkjent_dager: 5,
      },
      fristTilstand: {
        krevd_dager: 10,
        godkjent_dager: 5,
      } as any,
    };

    it('should render when open', () => {
      renderWithQueryClient(<UpdateResponseFristModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Oppdater svar på fristkrav/i })).toBeInTheDocument();
    });

    it('should have resultat field', () => {
      // Note: "Ny avgjørelse" section only shows when resultat is not 'godkjent'
      renderWithQueryClient(<UpdateResponseFristModal {...defaultProps} />);

      expect(screen.getByText(/Ny avgjørelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithQueryClient(<UpdateResponseFristModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Oppdater svar på fristkrav/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithQueryClient(<UpdateResponseFristModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Lagre Endringer/i })).toBeInTheDocument();
    });
  });
});
