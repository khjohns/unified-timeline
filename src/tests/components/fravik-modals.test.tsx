/**
 * Functional tests for Fravik Modal Components
 *
 * Tests basic rendering, validation, and structure of fravik modal components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/primitives/Toast';
import {
  OpprettFravikModal,
  LeggTilMaskinModal,
  SendInnModal,
} from '@/components/fravik';
import type { FravikState } from '@/types/fravik';

// Mock the API module
vi.mock('@/api/fravik', () => ({
  opprettFravikSoknad: vi.fn().mockResolvedValue('FRAVIK-TEST-001'),
  leggTilMaskin: vi.fn().mockResolvedValue('MASKIN-TEST-001'),
  sendInnSoknad: vi.fn().mockResolvedValue(undefined),
  oppdaterFravikSoknad: vi.fn().mockResolvedValue(undefined),
}));

// Create test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Wrapper with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>{ui}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// Mock FravikState for SendInnModal
const mockFravikState: FravikState = {
  soknad_id: 'FRAVIK-TEST-001',
  sakstype: 'fravik',
  prosjekt_id: 'PROJ-001',
  prosjekt_navn: 'Test Prosjekt',
  prosjekt_nummer: 'P-2025-001',
  rammeavtale: 'Grunnarbeider',
  hovedentreprenor: 'Test Entreprenør AS',
  soker_navn: 'Ola Nordmann',
  soker_epost: 'ola@test.no',
  soknad_type: 'machine',
  frist_for_svar: '2025-02-15',
  er_haste: false,
  status: 'utkast',
  maskiner: {
    'MASKIN-001': {
      maskin_id: 'MASKIN-001',
      maskin_type: 'Gravemaskin',
      start_dato: '2025-02-01',
      slutt_dato: '2025-04-01',
      begrunnelse: 'Test begrunnelse',
      markedsundersokelse: true,
      samlet_status: 'ikke_vurdert',
    },
  },
  godkjenningskjede: {
    boi_vurdering: { fullfort: false },
    pl_vurdering: { fullfort: false },
    arbeidsgruppe_vurdering: { fullfort: false },
    eier_beslutning: { fullfort: false },
    gjeldende_steg: 'boi',
    neste_godkjenner_rolle: 'BOI',
  },
  antall_events: 1,
  antall_maskiner: 1,
  antall_godkjente_maskiner: 0,
  antall_avslatte_maskiner: 0,
  alle_maskiner_vurdert: false,
  kan_sendes_inn: true,
  er_ferdigbehandlet: false,
  neste_handling: {
    rolle: 'SOKER',
    handling: 'Send inn søknaden',
  },
  visningsstatus: 'Utkast',
  opprettet: '2025-01-10T10:00:00Z',
  siste_oppdatert: '2025-01-10T10:00:00Z',
};

describe('Fravik Modal Components - Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to prevent restore prompts from showing
    window.localStorage.clear();
  });

  // ==========================================================================
  // OpprettFravikModal Tests
  // ==========================================================================

  describe('OpprettFravikModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
    };

    it('should render when open', () => {
      renderWithProviders(<OpprettFravikModal {...defaultProps} />);

      expect(
        screen.getByRole('dialog', { name: /Opprett fravik-søknad/i })
      ).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<OpprettFravikModal {...defaultProps} open={false} />);

      expect(
        screen.queryByRole('dialog', { name: /Opprett fravik-søknad/i })
      ).not.toBeInTheDocument();
    });

    it('should have prosjektnavn field', () => {
      renderWithProviders(<OpprettFravikModal {...defaultProps} />);

      expect(screen.getByText(/Prosjektnavn/i)).toBeInTheDocument();
    });

    it('should have prosjekt-ID field', () => {
      renderWithProviders(<OpprettFravikModal {...defaultProps} />);

      expect(screen.getByText(/Prosjekt-ID/i)).toBeInTheDocument();
    });

    it('should have søker navn field', () => {
      renderWithProviders(<OpprettFravikModal {...defaultProps} />);

      expect(screen.getByText(/Ditt navn/i)).toBeInTheDocument();
    });

    it('should have søknadstype section', () => {
      renderWithProviders(<OpprettFravikModal {...defaultProps} />);

      expect(screen.getByText(/Type søknad/i)).toBeInTheDocument();
    });

    it('should have hastebehandling section', () => {
      renderWithProviders(<OpprettFravikModal {...defaultProps} />);

      expect(screen.getByText(/Hastebehandling/i)).toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<OpprettFravikModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Opprett søknad/i })
      ).toBeInTheDocument();
    });

    it('should call onOpenChange when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const handleOpenChange = vi.fn();

      renderWithProviders(
        <OpprettFravikModal open={true} onOpenChange={handleOpenChange} />
      );

      await user.click(screen.getByRole('button', { name: /Avbryt/i }));
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('should show haste begrunnelse field when haste is checked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OpprettFravikModal {...defaultProps} />);

      // The Hastebehandling section is collapsible and closed by default
      // First expand it by clicking the section header
      const hasteSection = screen.getByText(/Hastebehandling/i);
      await user.click(hasteSection);

      // Now find and click the checkbox
      await waitFor(() => {
        expect(screen.getByText(/Dette er en hastesøknad/i)).toBeInTheDocument();
      });
      const hasteCheckbox = screen.getByRole('checkbox', { name: /Dette er en hastesøknad/i });
      await user.click(hasteCheckbox);

      // Should now show the begrunnelse field
      await waitFor(() => {
        expect(
          screen.getByText(/Begrunnelse for hastebehandling/i)
        ).toBeInTheDocument();
      });
    });

    it('should show validation errors on submit with empty form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<OpprettFravikModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Opprett søknad/i }));

      // Wait for validation errors to appear
      await waitFor(() => {
        expect(screen.getAllByText(/Påkrevd/i).length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // LeggTilMaskinModal Tests
  // ==========================================================================

  describe('LeggTilMaskinModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      soknadId: 'FRAVIK-TEST-001',
    };

    it('should render when open', () => {
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} />);

      expect(
        screen.getByRole('dialog', { name: /Legg til maskin/i })
      ).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} open={false} />);

      expect(
        screen.queryByRole('dialog', { name: /Legg til maskin/i })
      ).not.toBeInTheDocument();
    });

    it('should have maskintype section', () => {
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} />);

      expect(screen.getByText(/Maskintype/i)).toBeInTheDocument();
    });

    it('should have bruksperiode section', () => {
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} />);

      expect(screen.getByText(/Bruksperiode/i)).toBeInTheDocument();
    });

    it('should have begrunnelse section', () => {
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} />);

      // Look for the section title "Begrunnelse" - there may be multiple
      // matches (section title and field label)
      expect(screen.getAllByText(/Begrunnelse/i).length).toBeGreaterThan(0);
    });

    it('should have markedsundersøkelse section', () => {
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} />);

      // Markedsundersøkelse section should be visible
      expect(screen.getAllByText(/Markedsundersøkelse/i).length).toBeGreaterThan(0);
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Legg til maskin/i })
      ).toBeInTheDocument();
    });

    it('should show annet type field when Annet is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} />);

      // Find and click the "Annet" radio option
      const annetRadio = screen.getByLabelText(/Annet/i);
      await user.click(annetRadio);

      // Should now show the specify field
      await waitFor(() => {
        expect(screen.getByText(/Spesifiser maskintype/i)).toBeInTheDocument();
      });
    });

    it('should show leverandører field when markedsundersøkelse is checked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} />);

      // Find and click the markedsundersøkelse checkbox by role
      const checkbox = screen.getByRole('checkbox', {
        name: /Jeg har gjennomført markedsundersøkelse/i,
      });
      await user.click(checkbox);

      // Should now show the leverandører field
      await waitFor(() => {
        expect(
          screen.getByText(/Hvilke leverandører er undersøkt/i)
        ).toBeInTheDocument();
      });
    });

    it('should show validation errors on submit with empty form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LeggTilMaskinModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Legg til maskin/i }));

      // Wait for validation errors to appear
      // The schema has required fields like maskin_type, start_dato, slutt_dato, begrunnelse
      await waitFor(
        () => {
          // Look for any error message (either "Påkrevd" or specific validation messages)
          const errorMessages = screen.queryAllByText(/Påkrevd|må være|Velg/i);
          expect(errorMessages.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });
  });

  // ==========================================================================
  // SendInnModal Tests
  // ==========================================================================

  describe('SendInnModal', () => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      soknadId: 'FRAVIK-TEST-001',
      state: mockFravikState,
    };

    it('should render when open', () => {
      renderWithProviders(<SendInnModal {...defaultProps} />);

      expect(
        screen.getByRole('dialog', { name: /Send inn søknad/i })
      ).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(<SendInnModal {...defaultProps} open={false} />);

      expect(
        screen.queryByRole('dialog', { name: /Send inn søknad/i })
      ).not.toBeInTheDocument();
    });

    it('should show oppsummering section', () => {
      renderWithProviders(<SendInnModal {...defaultProps} />);

      expect(screen.getByText(/Oppsummering/i)).toBeInTheDocument();
    });

    it('should show project name in summary', () => {
      renderWithProviders(<SendInnModal {...defaultProps} />);

      expect(screen.getByText(/Test Prosjekt/i)).toBeInTheDocument();
    });

    it('should show søker name in summary', () => {
      renderWithProviders(<SendInnModal {...defaultProps} />);

      expect(screen.getByText(/Ola Nordmann/i)).toBeInTheDocument();
    });

    it('should have confirmation checkbox', () => {
      renderWithProviders(<SendInnModal {...defaultProps} />);

      expect(
        screen.getByLabelText(/Jeg bekrefter at informasjonen/i)
      ).toBeInTheDocument();
    });

    it('should have submit and cancel buttons', () => {
      renderWithProviders(<SendInnModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Avbryt/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Send inn søknad/i })
      ).toBeInTheDocument();
    });

    it('should show warning when kan_sendes_inn is false', () => {
      const stateNotReady = {
        ...mockFravikState,
        kan_sendes_inn: false,
        antall_maskiner: 0,
      };
      renderWithProviders(<SendInnModal {...defaultProps} state={stateNotReady} />);

      expect(
        screen.getByText(/Søknaden kan ikke sendes inn ennå/i)
      ).toBeInTheDocument();
    });

    it('should disable submit button when kan_sendes_inn is false', () => {
      const stateNotReady = {
        ...mockFravikState,
        kan_sendes_inn: false,
      };
      renderWithProviders(<SendInnModal {...defaultProps} state={stateNotReady} />);

      const submitButton = screen.getByRole('button', { name: /Send inn søknad/i });
      expect(submitButton).toBeDisabled();
    });

    it('should show error when submitting without confirmation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SendInnModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Send inn søknad/i }));

      // Wait for validation error to appear
      await waitFor(() => {
        expect(
          screen.getByText(/Du må bekrefte at informasjonen er korrekt/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Modal Close Behavior Tests
  // ==========================================================================

  describe('Modal close behavior', () => {
    it('OpprettFravikModal - should call onOpenChange when cancel is clicked', async () => {
      const user = userEvent.setup();
      const handleOpenChange = vi.fn();

      renderWithProviders(
        <OpprettFravikModal open={true} onOpenChange={handleOpenChange} />
      );

      await user.click(screen.getByRole('button', { name: /Avbryt/i }));
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('LeggTilMaskinModal - should call onOpenChange when cancel is clicked', async () => {
      const user = userEvent.setup();
      const handleOpenChange = vi.fn();

      renderWithProviders(
        <LeggTilMaskinModal
          open={true}
          onOpenChange={handleOpenChange}
          soknadId="TEST-001"
        />
      );

      await user.click(screen.getByRole('button', { name: /Avbryt/i }));
      // Note: LeggTilMaskinModal may show confirm dialog if form is dirty
      // For clean form, it should close directly
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('SendInnModal - should call onOpenChange when cancel is clicked', async () => {
      const user = userEvent.setup();
      const handleOpenChange = vi.fn();

      renderWithProviders(
        <SendInnModal
          open={true}
          onOpenChange={handleOpenChange}
          soknadId="TEST-001"
          state={mockFravikState}
        />
      );

      await user.click(screen.getByRole('button', { name: /Avbryt/i }));
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
