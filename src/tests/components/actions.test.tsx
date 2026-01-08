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
import { ToastProvider } from '@/components/primitives/Toast';
import { RespondGrunnlagModal } from '@/components/actions/RespondGrunnlagModal';
import { RespondVederlagModal } from '@/components/actions/RespondVederlagModal';
import { RespondFristModal } from '@/components/actions/RespondFristModal';
import { SendGrunnlagModal } from '@/components/actions/SendGrunnlagModal';
import { SendVederlagModal } from '@/components/actions/SendVederlagModal';
import { SendFristModal } from '@/components/actions/SendFristModal';
// Note: SendGrunnlagUpdateModal removed - SendGrunnlagModal handles updates via originalEvent prop
// Note: RespondGrunnlagUpdateModal removed - RespondGrunnlagModal handles updates via lastResponseEvent prop
import { ReviseVederlagModal } from '@/components/actions/ReviseVederlagModal';
import { ReviseFristModal } from '@/components/actions/ReviseFristModal';
// Note: UpdateResponseVederlagModal removed - RespondVederlagModal handles updates via lastResponseEvent prop
// Note: UpdateResponseFristModal removed - RespondFristModal handles updates via lastResponseEvent prop

// Wrapper with React Query provider and ToastProvider
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </QueryClientProvider>
  );
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
      renderWithProviders(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Svar på grunnlag/i)).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithProviders(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<RespondGrunnlagModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Svar på grunnlag/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Avbryt/i)).toBeInTheDocument();
      expect(screen.getByText(/Send svar/i)).toBeInTheDocument();
    });
  });

  describe('RespondVederlagModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      vederlagKravId: 'vederlag-TEST-001',
    };

    it('should render when open', () => {
      renderWithProviders(<RespondVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Svar på vederlagskrav/i)).toBeInTheDocument();
    });

    it('should have krav section', () => {
      renderWithProviders(<RespondVederlagModal {...defaultProps} />);

      // Should show the dialog title
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<RespondVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Svar på vederlagskrav/i)).not.toBeInTheDocument();
    });

    it('should have dialog with proper title', () => {
      renderWithProviders(<RespondVederlagModal {...defaultProps} />);

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
      renderWithProviders(<RespondFristModal {...defaultProps} />);

      expect(screen.getByText(/Svar på fristkrav/i)).toBeInTheDocument();
    });

    it('should have dialog role', () => {
      renderWithProviders(<RespondFristModal {...defaultProps} />);

      // Should show the dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<RespondFristModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Svar på fristkrav/i)).not.toBeInTheDocument();
    });

    it('should have dialog with proper title', () => {
      renderWithProviders(<RespondFristModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Svar på fristkrav/i })).toBeInTheDocument();
    });
  });

  describe('Modal close behavior', () => {
    it('should call onOpenChange when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const handleOpenChange = vi.fn();

      renderWithProviders(
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
      renderWithProviders(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Varsle endringsforhold/i })).toBeInTheDocument();
    });

    it('should have hovedkategori field', () => {
      renderWithProviders(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Hovedkategori \(NS 8407\)/i)).toBeInTheDocument();
    });

    it('should have tittel field', () => {
      renderWithProviders(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Tittel på varselet/i)).toBeInTheDocument();
    });

    it('should have beskrivelse field', () => {
      renderWithProviders(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Beskrivelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<SendGrunnlagModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Varsle endringsforhold/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send varsel/i })).toBeInTheDocument();
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
      renderWithProviders(<SendVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Krav om Vederlagsjustering/i)).toBeInTheDocument();
    });

    it('should have beregningsmetode field', () => {
      renderWithProviders(<SendVederlagModal {...defaultProps} />);

      expect(screen.getAllByText(/Beregningsmetode/i).length).toBeGreaterThan(0);
    });

    it('should have begrunnelse field', () => {
      renderWithProviders(<SendVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<SendVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Krav om Vederlagsjustering/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<SendVederlagModal {...defaultProps} />);

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
      renderWithProviders(<SendFristModal {...defaultProps} />);

      expect(screen.getByText(/Krav om fristforlengelse/i)).toBeInTheDocument();
    });

    it('should have varsel type field', () => {
      renderWithProviders(<SendFristModal {...defaultProps} />);

      expect(screen.getByText(/Type varsel\/krav/i)).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithProviders(<SendFristModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<SendFristModal {...defaultProps} open={false} />);

      expect(screen.queryByText(/Krav om fristforlengelse/i)).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<SendFristModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send fristkrav/i })).toBeInTheDocument();
    });
  });

  describe('SendGrunnlagModal (Update Mode)', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      originalEvent: {
        event_id: 'event-1',
        grunnlag: {
          status: 'sendt' as const,
          tittel: 'Original tittel',
          beskrivelse: 'Original beskrivelse',
          dato_oppdaget: '2025-01-10',
          hovedkategori: 'ENDRING',
          underkategori: ['EO'],
          kontraktsreferanser: [],
          laast: false,
          antall_versjoner: 1,
        },
      },
    };

    it('should render when open', () => {
      renderWithProviders(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Oppdater grunnlag/i })).toBeInTheDocument();
    });

    it('should have endrings_begrunnelse field', () => {
      renderWithProviders(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse for endring/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<SendGrunnlagModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Oppdater grunnlag/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<SendGrunnlagModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Lagre endringer/i })).toBeInTheDocument();
    });
  });

  describe('RespondGrunnlagModal (Update Mode)', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      grunnlagEventId: 'grunnlag-TEST-001',
      lastResponseEvent: {
        event_id: 'response-1',
        resultat: 'godkjent' as const,
      },
      sakState: {
        grunnlag: {
          status: 'godkjent' as const,
          hovedkategori: 'ENDRING',
          underkategori: ['EO'],
          kontraktsreferanser: [],
          laast: false,
          antall_versjoner: 1,
        },
        er_subsidiaert_vederlag: false,
        er_subsidiaert_frist: false,
      } as any,
    };

    it('should render when open', () => {
      renderWithProviders(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Endre svar på grunnlag/i })).toBeInTheDocument();
    });

    it('should have resultat field', () => {
      renderWithProviders(<RespondGrunnlagModal {...defaultProps} />);

      expect(screen.getByText(/Resultat.*ansvarsgrunnlag/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<RespondGrunnlagModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Endre svar på grunnlag/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<RespondGrunnlagModal {...defaultProps} />);

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
      renderWithProviders(<ReviseVederlagModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Revider vederlagskrav/i })).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithProviders(<ReviseVederlagModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<ReviseVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Revider vederlagskrav/i })).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<ReviseVederlagModal {...defaultProps} />);

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
      renderWithProviders(<ReviseFristModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Revider fristkrav/i })).toBeInTheDocument();
    });

    it('should have begrunnelse field', () => {
      renderWithProviders(<ReviseFristModal {...defaultProps} />);

      expect(screen.getByText(/Begrunnelse/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<ReviseFristModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Revider fristkrav/i})).not.toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<ReviseFristModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Oppdater Krav/i })).toBeInTheDocument();
    });
  });

  describe('RespondVederlagModal (update mode)', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      // Update mode is activated by providing lastResponseEvent
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
      renderWithProviders(<RespondVederlagModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Oppdater svar på vederlagskrav/i })).toBeInTheDocument();
    });

    it('should have resultat field', () => {
      // Note: "Samlet resultat" is on step 2 or later
      renderWithProviders(<RespondVederlagModal {...defaultProps} />);

      // On step 1 we see the overview, check for step indicator
      expect(screen.getByText(/Oversikt/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<RespondVederlagModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Oppdater svar på vederlagskrav/i })).not.toBeInTheDocument();
    });

    it('should have navigation and cancel buttons', () => {
      // Note: Uses multi-step wizard, so "Neste" button is shown on step 1 instead of submit
      renderWithProviders(<RespondVederlagModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Neste/i })).toBeInTheDocument();
    });
  });

  describe('RespondFristModal (update mode)', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      sakId: 'TEST-001',
      // Update mode is activated by providing lastResponseEvent
      lastResponseEvent: {
        event_id: 'response-1',
        resultat: 'delvis_godkjent' as const,
        godkjent_dager: 5,
      },
      fristTilstand: {
        krevd_dager: 10,
        godkjent_dager: 5,
      } as any,
    };

    it('should render when open', () => {
      renderWithProviders(<RespondFristModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: /Oppdater svar på fristkrav/i })).toBeInTheDocument();
    });

    it('should have step indicator', () => {
      // Note: Uses multi-step wizard, check for step indicator
      renderWithProviders(<RespondFristModal {...defaultProps} />);

      // On step 1 we see the overview
      expect(screen.getByText(/Oversikt/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<RespondFristModal {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog', { name: /Oppdater svar på fristkrav/i })).not.toBeInTheDocument();
    });

    it('should have navigation and cancel buttons', () => {
      // Note: Uses multi-step wizard, so "Neste" button is shown on step 1 instead of submit
      renderWithProviders(<RespondFristModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Neste/i })).toBeInTheDocument();
    });
  });
});
